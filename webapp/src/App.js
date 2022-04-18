import { createContext, useReducer } from 'react';
import { Outlet } from 'react-router-dom';

import { reducer, initialState } from './libs/reducer'

import Header from './layouts/header';
import Footer from './layouts/footer';

import './App.css';

const appData = {
  localVideos : new Map(),  // for add-source.js
  localStreams: new Map(),
  roomClient: {},
}

export const AppContext = createContext()


function App() {
  const [ state, dispatch ] = useReducer( reducer, initialState )
  return (
    <AppContext.Provider value={{ appData, state, dispatch }}>
      <div className="App">
        <Header />
        <main>
          <Outlet />
        </main>
        <Footer />
      </div>
    </AppContext.Provider>
  );
}

export default App;
