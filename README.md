# MiMuse React Dashboard

React + TypeScript + Vite + TailwindCSS 버전의 MiMuse 자동화 대시보드입니다.

## 설치 및 실행

Node.js 18+ 가 필요합니다. [nodejs.org](https://nodejs.org) 에서 설치하세요.

```bash
cd C:\Users\user\Desktop\mimuse-react
npm install
npm run dev
```

개발 서버가 http://localhost:5173 에서 실행됩니다.

## 빌드

```bash
npm run build
npm run preview
```

## 프로젝트 구조

```
mimuse-react/
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
