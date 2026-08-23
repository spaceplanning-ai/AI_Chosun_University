'use client';

import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { Button, Panel, SectionNav, Sheet } from '@namdo-prism/core/ui';
import type { ResourceSchema } from '@/config/resourceSchemas';
import { useSettingsForm } from './SettingsForm';

/**
 * 구역으로 나눠 읽고, 창에서 고치는 설정 화면.
 *
 * ── 왜 이 틀을 따로 두는가 ─────────────────────────────────────────
 * 설정 화면이 여럿인데 그때마다 «왼쪽 목차 + 구분선 + 구역별 설정 창»을 다시 짜면,
 * 어떤 화면은 창에서 고치고 어떤 화면은 본문에서 바로 고치는 식으로 갈린다.
 * 화면이 정하는 것은 «어떤 칸을 어떤 이름으로 묶을지»뿐이고, 나머지는 여기서 한 번만 정한다.
 *
 * ── 왜 고치는 일은 창에서 하는가 ───────────────────────────────────
 * 이 값들은 결과를 통째로 바꾼다. 화면을 훑다가 숫자 칸을 잘못 건드려 조용히 바뀌는 것이
 * 가장 나쁘다. 평소에는 값만 보이고 「설정」을 눌러야 고칠 수 있다.
 * 창을 닫기 전까지는 바깥 값이 그대로라, 취소하면 없던 일이 된다.
 */

export interface SettingsSection {
  id: string;
  /** 왼쪽 목차와 구역 제목에 함께 쓰는 이름. 칸 이름이 아니라 «무엇을 정하는가»를 적는다. */
  label: string;
  /**
   * 제목 아래 한 줄. 이 구역을 바꾸면 무엇이 달라지는지 적는다.
   * 창을 열었을 때도 같은 말이 머리말에 붙는다 — 고치는 순간에 가장 필요한 말이라서.
   */
  description?: string;
  /** 이 구역이 다루는 칸. 스키마의 순서가 아니라 하는 일로 묶는다. */
  fields: readonly string[];
}

export interface SectionedSettingsViewProps {
  schema: ResourceSchema;
  /** 왼쪽 목차의 이름. 스크린리더가 «무엇의 목차인가»를 읽는다. */
  navLabel: string;
  sections: readonly SettingsSection[];
  /** 구역에 설명이 없을 때 창 머리말 아래 쓸 말. */
  sheetDescription: string;
}

export function SectionedSettingsView({
  schema,
  navLabel,
  sections,
  sheetDescription,
}: SectionedSettingsViewProps) {
  const form = useSettingsForm(schema);
  /** 지금 고치고 있는 구역. 없으면 전부 조회 상태다. */
  const [editing, setEditing] = useState<string>();

  const open = sections.find((section) => section.id === editing);

  /** 창을 닫는다. 고치던 것은 없던 일이 된다. */
  const discard = () => {
    form.discard();
    setEditing(undefined);
  };

  return (
    <div className="flex flex-col gap-lg">
      <Panel title={schema.title} description={schema.description} action={form.action}>
        <div className="grid gap-lg lg:grid-cols-[11rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-lg lg:self-start">
            <SectionNav
              label={navLabel}
              items={sections.map((section) => ({ id: section.id, label: section.label }))}
            />
          </aside>

          <div className="min-w-0">
            {sections.map((section, index) => (
              <div key={section.id}>
                {index === 0 ? null : (
                  <hr className="my-lg border-0 border-t border-line-subtle" />
                )}

                <section id={section.id} aria-labelledby={`${section.id}-title`}>
                  <header className="flex flex-wrap items-center justify-between gap-md">
                    <div className="min-w-0">
                      <h3 id={`${section.id}-title`} className="text-subhead font-bold text-content">
                        {section.label}
                      </h3>
                      {section.description === undefined ? null : (
                        <p className="mt-2xs text-caption text-content-muted">{section.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="quiet"
                      iconLeft={Pencil}
                      onClick={() => setEditing(section.id)}
                    >
                      설정
                    </Button>
                  </header>

                  <div className="mt-md">{form.fields(section.fields, { readOnly: true })}</div>
                </section>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Sheet
        open={open !== undefined}
        onClose={discard}
        placement="center"
        title={open?.label ?? ''}
        description={open?.description ?? sheetDescription}
        footer={
          <span className="flex justify-end gap-sm">
            <Button variant="quiet" onClick={discard}>
              취소
            </Button>
            <Button
              variant="accent"
              iconLeft={Check}
              onClick={() => {
                form.save();
                setEditing(undefined);
              }}
            >
              저장
            </Button>
          </span>
        }
      >
        {open ? form.fields(open.fields) : null}
      </Sheet>
    </div>
  );
}
