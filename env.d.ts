/// <reference types="vite/client" />
interface ImportMetaEnv {
    readonly VITE_APP_TITLE: string;
    // 根据需要添加更多环境变量
    readonly BASE_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}