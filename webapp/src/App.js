import { createContext, useReducer } from 'react';

import { reducer, initialState } from './libs/reducer'

import Header from './layouts/header';
import Main   from './layouts/main';
import Footer from './layouts/footer';
import './App.css';

const appData = {
  myStream: null,
  roomClient: {} 
}

export const AppContext = createContext()


function App() {
  const [ state, dispatch ] = useReducer( reducer, initialState )
  return (
    <AppContext.Provider value={{ appData, state, dispatch }}>
      <div className="App">
        <Header />
        <Main />
        <Footer />
      </div>
    </AppContext.Provider>
  );
}

export default App;
