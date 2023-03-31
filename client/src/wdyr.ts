/// <reference types="@welldone-software/why-did-you-render" />
import React from 'react';
import { useLists, useItems } from './components/Usehooks';

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    trackExtraHooks: [ [useLists, "useLists"],[useItems, "useItems"] ]

  });
}