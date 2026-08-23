# 관광 데이터 교체 절차

> 피드백 문서 3.2 — "데이터는 CSV/JSON 교체 후 재임베딩 또는 검색인덱스 갱신이 가능해야 하며,
> **개발자 수작업에 종속되지 않도록** 스크립트 또는 명령절차를 인계해 주십시오."

이 문서 하나로 관광지와 공식문서를 통째로 교체할 수 있습니다. TypeScript를 몰라도 됩니다.

---

## 1. 원본 파일

| 파일 | 내용 |
| --- | --- |
| `attractions.json` | 관광지 표준데이터 |
| `officialDocuments.json` | 공식 관광문서 색인 |

같은 폴더의 `.ts` 파일은 **로더**일 뿐 데이터가 아닙니다. 고치지 마십시오.

## 2. 명령 세 가지

프로젝트 루트에서 실행합니다.

```bash
npm run data:export      # JSON → CSV  (엑셀에서 편집하려면 여기서 시작)
npm run data:import      # CSV → JSON  (편집 결과를 반영)
npm run data:validate    # 무결성 검사만 수행
```

CSV는 `packages/core/data-csv/` 에 생성됩니다. UTF-8 BOM이 붙어 있어 엑셀에서 한글이 깨지지 않습니다.

### 전형적인 작업 흐름

```
npm run data:export
  → data-csv/attractions.csv 를 엑셀로 열어 편집 → CSV(UTF-8)로 저장
npm run data:import
  → 검사 통과 시 JSON 반영, 실패 시 JSON은 그대로 두고 오류 목록 출력
npm run dev:kiosk
```

`import` 는 **검사를 통과하지 못하면 아무것도 쓰지 않습니다.** 깨진 JSON을 남겨
앱이 아예 뜨지 않는 상황을 만들지 않기 위한 것입니다.

## 3. 검색 색인 갱신

**별도 명령이 필요 없습니다.** 검색 색인은 앱이 시작될 때 JSON에서 매번 새로 만들어지며,
문서 키워드에 더해 그 문서가 다루는 관광지의 이름·소재지·지역명이 자동으로 파생 키워드로
붙습니다. 문서마다 '광주' '전남' 같은 지역어를 일일이 적을 필요가 없습니다.

> 백엔드 임베딩/Vector DB가 연결된 뒤에는 이 지점에 재임베딩 명령이 추가됩니다.
> 프런트엔드에서 교체해야 할 파일은 `domain/linkage-recommendation/retrieval.ts` 하나입니다.

## 4. 열 설명 — attractions.csv

| 열 | 형식 | 설명 |
| --- | --- | --- |
| `id` | 영문 소문자·하이픈 | 고유 식별자. **한번 정하면 바꾸지 마십시오** — 로그와 QR이 이 값을 참조합니다. |
| `name` | 문자열 | 화면에 표시되는 관광지명 |
| `region` | `gwangju` \| `jeonnam` | 지역 구분 |
| `district` | 문자열 | `광주 동구`, `전남 담양군` 형식. 제목의 짧은 지명이 여기서 파생됩니다. |
| `address` | 문자열 | 도로명 주소 |
| `coordinates.lat` / `.lng` | 실수 | **이동시간 계산의 근거입니다.** 부정확하면 일정이 통째로 어긋납니다. |
| `categories` | 목록 | `culture` `nature` `sea` `food` `photo` `history` `activity` `rest` |
| `audiences` | 목록 | `solo` `couple` `friends` `child` `parents` `group` |
| `openingHours.open` / `.close` | `HH:MM` | 24시간 개방은 `00:00`–`24:00` |
| `closedDays` | 목록 | 요일 한 글자 (`월`). 연중무휴는 비워 둡니다. |
| `averageStayMinutes` | 정수 | 평균 체류시간(분) |
| `setting` | `indoor` \| `outdoor` \| `mixed` | 실내·실외 구분 |
| `walkingLoad` | 0–100 | 보행부담. 높을수록 힘든 곳 |
| `familyScore` | 0–100 | 유아차·화장실·휴게공간 기준 가족 적합도 |
| `seniorScore` | 0–100 | 경사·벤치·주차 근접성 기준 고령자 적합도 |
| `rainySuitability` | 0–100 | 우천 시 관람 가능 정도 |
| `transitAccess` | 0–100 | 대중교통만으로 도달 가능한 정도 |
| `costLevel` | 0–100 | 1인 기준 비용 부담 |
| `adjacentIds` | 목록 | 도보·근거리로 이어지는 관광지 id. 이동시간과 여정 연속성에 반영됩니다. |
| `summary` | 문자열 | 상세 설명 2문장 내외 |
| `highlight` | 문자열 | 카드에 노출되는 한 줄 특징 |
| `motif` | 아래 목록 | `city` `art` `forest` `sea` `field` `heritage` `food` `night` |

> **motif** 는 사진 대신 렌더링되는 시각 모티프입니다. 실사진이 확보되기 전에도
> 전시 화면이 비어 보이지 않게 하기 위한 항목이며, 사진을 넣게 되면 사용하지 않아도 됩니다.

## 5. 열 설명 — officialDocuments.csv

| 열 | 형식 | 설명 |
| --- | --- | --- |
| `id` | 영문·하이픈 | 고유 식별자 |
| `title` | 문자열 | 화면에 노출되는 문서명 |
| `issuer` | 문자열 | 출처기관명 |
| `issuerType` | `government` \| `publicAgency` \| `tourismOrg` \| `facility` | **신뢰도 배점에 직접 반영됩니다.** |
| `url` | URL | 원문 주소 |
| `updatedAt` | `YYYY-MM-DD` | **최종 갱신일. 신뢰도 배점에 직접 반영됩니다.** |
| `coversAttractionIds` | 목록 | 이 문서가 근거를 제공하는 관광지 id |
| `fields` | 목록 | `openingHours` `address` `contact` `access` `fee` `closure` |
| `keywords` | 목록 | 검색 색인용 키워드 |
| `excerpt` | 문자열 | 근거 문장 발췌 |

### 신뢰도에 직접 영향을 주는 세 항목

`issuerType` · `updatedAt` · `fields` 는 화면에 보이기만 하는 값이 아니라
**정보 신뢰도 점수를 결정하는 입력**입니다. 추정값으로 채우면 추천에서 제외되어야 할
관광지가 통과하거나 그 반대가 됩니다. 반드시 실제 문서를 확인하고 기입하십시오.

| 항목 | 배점 | 만점 조건 |
| --- | --- | --- |
| 공식기관 자료 여부 | 35 | `issuerType`이 `government` |
| 최신 갱신일 여부 | 25 | `updatedAt`이 180일 이내 (540일 초과 시 0점) |
| 복수 공식 출처 일치 | 20 | 서로 다른 `issuer` 2곳 이상이 같은 관광지를 다룸 |
| 정보 항목 확인 | 20 | `fields`가 4종 이상 |

신뢰도 **55점 미만은 추천 제외**, **70점 미만은 순위 하향**입니다.
배점과 임계값은 `packages/core/src/config/scoring.ts` 에서 조정합니다.

## 6. 배열 값 입력 규칙

CSV 한 칸 안에서 `|` (파이프)로 구분합니다. 쉼표는 엑셀에서 열이 갈라지므로 쓰지 않습니다.

```
categories        culture|history|photo
adjacentIds       daein-market|yangnim
closedDays        월
```

## 7. 무결성 검사가 잡아 주는 것

- `id` 중복, 빈 `id`
- 0–100 범위를 벗어난 점수
- `HH:MM` / `YYYY-MM-DD` 형식 오류
- 존재하지 않는 관광지를 가리키는 `adjacentIds` · `coversAttractionIds`
- 공식문서가 하나도 없는 관광지 (경고 — 항상 추천에서 제외됩니다)

개발 모드에서는 앱이 로드되는 순간에도 같은 검사가 돌아, 잘못된 데이터가
화면까지 흘러가기 전에 오류로 드러납니다.

## 8. 데이터 규모 기준 (제안서 12.2)

| 구분 | A안 | 현재 |
| --- | --- | --- |
| 관광지 | 12∼15개 | 22곳 (광주 8 · 전남 14) |
| 공식문서 | 30건 내외 | 41건 |
| 기준 평가질문 | 30개 이상 | 32개 (`benchmarkQuestions.ts`) |

기준 평가질문은 검수 게이트의 정답지이므로, 관광지를 교체하면 함께 갱신해야 합니다.
질문마다 `expectedDocumentIds` 가 실제 문서 id를 가리키는지 확인하십시오.
