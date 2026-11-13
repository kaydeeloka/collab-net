# CollabNet React Dashboard

React + TypeScript + Vite + TailwindCSS 버전의 CollabNet 자동화 대시보드입니다.

## 설치 및 실행

Node.js 18+ 가 필요합니다. [nodejs.org](https://nodejs.org) 에서 설치하세요.

```bash
cd C:\Users\user\Desktop\collabnet-react
npm install
npm run dev
```

개발 서버가 http://localhost:5173 에서 실행됩니다.

## 빌드

```bash
npm run build
npm run preview
```

## 대시보드 데모 데이터

Supabase SQL Editor에서 [`demoDb/seeds/dashboard-demo.sql`](demoDb/seeds/dashboard-demo.sql)을 실행하면 실제 캠페인과 분리된 `Demo · Dashboard` 차수와 샘플 데이터가 생성됩니다. 대시보드의 차수 선택기에서 해당 차수를 선택하면 인플루언서, 브랜드, EMS 배송, 모니터링, 트렌드 요약 예시를 확인할 수 있습니다. 스크립트는 고정된 데모 ID를 사용하므로 여러 번 실행해도 중복되지 않습니다.

현재 대시보드는 외부 연결 없이 코드에 포함된 샘플 데이터를 사용하며, 화면에 `Demo mode` 안내가 표시됩니다. 실제 데이터를 연결할 때는 `VITE_LOCAL_DEMO_URL`과 `VITE_LOCAL_DEMO_ANON_KEY` 환경 변수를 설정하고 각 화면의 로컬 데이터 로더를 Supabase 쿼리로 교체하면 됩니다. 환경 변수만 추가해도 데모 화면이 자동으로 실제 데이터로 바뀌지는 않습니다.

## 프로젝트 구조

```
collabnet-react/
├── api/                  # Google Apps Script 백엔드 (api/ 폴더 = 기존 gas/)
├── public/
│   └── img/              # 로고 이미지
├── src/
│   ├── lib/
│   │   ├── api.ts         # gasGet, gasPost API 유틸리티
│   │   └── utils.ts       # 포맷팅 함수들
│   ├── contexts/
│   │   ├── AuthContext.tsx  # PIN 잠금 인증 상태
│   │   └── ToastContext.tsx # 전역 토스트 알림
│   ├── components/
│   │   ├── Layout.tsx      # 내비게이션 바 + 라우터 아웃렛
│   │   ├── RequireAuth.tsx # 인증 보호 래퍼
│   │   ├── Modal.tsx       # 모달 오버레이
│   │   ├── Spinner.tsx     # 로딩 스피너
│   │   └── ConfirmToast.tsx # 확인 토스트
│   ├── pages/
│   │   ├── Lock.tsx        # PIN 잠금 화면 (PIN: US26)
│   │   ├── Dashboard.tsx   # 메인 대시보드
│   │   ├── Trends.tsx      # 트렌드 분석
│   │   ├── Listup.tsx      # 인플루언서 리스트업
│   │   ├── Outreach.tsx    # 아웃리치
│   │   ├── Confirmed.tsx   # 확정 인플루언서
│   │   ├── Ems.tsx         # EMS 트래킹
│   │   └── Monitoring.tsx  # 모니터링
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 라우팅

| URL | 페이지 |
|-----|--------|
| `/lock` | PIN 잠금 화면 |
| `/` | 대시보드 |
| `/trends` | 트렌드 분석 |
| `/listup` | 인플루언서 리스트업 |
| `/outreach` | 아웃리치 |
| `/confirmed` | 확정 인플루언서 |
| `/ems` | EMS 트래킹 |
| `/monitoring` | 인플루언서 모니터링 |

## GAS API

`src/lib/api.ts` 의 `GAS_URL` 상수에 Google Apps Script 배포 URL이 설정되어 있습니다.
