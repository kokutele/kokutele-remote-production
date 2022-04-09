import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css';
import App from './App';
import Home from './layouts/home';
import Entrance from './layouts/entrance';
import Main from './layouts/main'
import StudioViewer from './layouts/studio-viewer';
import reportWebVitals from './reportWebVitals';

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App/>}>
          <Route path="/" element={<Home />}/>
          <Route path="virtual-studio" element={<Entrance />} />
          <Route path="virtual-studio/:name" element={<Main />} />
          <Route path="viewer/:name" element={ <StudioViewer/> } />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
