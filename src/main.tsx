import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider, useI18n } from './i18n';
import './styles/global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Application root was not found');
}

function LocalizedApplication() {
  const { locale } = useI18n();
  return (
    <ConfigProvider
      locale={locale === 'zh-CN' ? zhCN : enUS}
      theme={{
        token: {
          colorPrimary: '#1648f5',
          colorInfo: '#1648f5',
          colorSuccess: '#12a56a',
          colorWarning: '#d98a09',
          colorError: '#d53b3b',
          colorText: '#0b1c3b',
          colorTextSecondary: '#5c6b82',
          colorBorder: '#dfe5ee',
          colorBgContainer: '#ffffff',
          borderRadius: 8,
          borderRadiusLG: 10,
          fontFamily:
            '"Inter", "SF Pro Display", "SF Pro Text", "Segoe UI", system-ui, sans-serif',
          controlHeight: 36,
        },
        components: {
          Layout: {
            bodyBg: '#ffffff',
            headerBg: '#ffffff',
            siderBg: '#ffffff',
          },
          Menu: {
            itemBorderRadius: 7,
            itemSelectedBg: '#edf3ff',
            itemSelectedColor: '#1648f5',
          },
          Table: {
            headerBg: '#fbfcfe',
            headerColor: '#44536c',
            rowHoverBg: '#f7faff',
          },
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <I18nProvider>
      <LocalizedApplication />
    </I18nProvider>
  </React.StrictMode>,
);
