import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

import './i18n';

// Call the element loader after the platform has been bootstrapped
defineCustomElements(window);

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
   <React.StrictMode>
    <App />
   </React.StrictMode>
);


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
