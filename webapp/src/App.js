import { createContext, useReducer } from 'react';

import { reducer, initialState } from './libs/reducer'

import Header from './layouts/header';
import Main   from './layouts/main';
import Footer from './layouts/footer';
import StudioViewer from './layouts/studio-viewer';

import './App.css';

const appData = {
  myStream: null,
  roomClient: {},
  studioViewer: new window.URLSearchParams( window.location.search ).get( 'studioViewer' ) === 'true'
}

export const AppContext = createContext()


function App() {
  const [ state, dispatch ] = useReducer( reducer, initialState )
  return (
    <AppContext.Provider value={{ appData, state, dispatch }}>
      { !appData.studioViewer ? (
      <div className="App">
        <Header />
        <Main />
        <Footer />
      </div>
      ):(
        <StudioViewer />
      )}
    </AppContext.Provider>
  );
}

export default App;
