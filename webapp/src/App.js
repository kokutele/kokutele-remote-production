import Header from './layouts/header';
import Main   from './layouts/main';
import Footer from './layouts/footer';
import './App.css';

function App() {
  return (
    <div className="App">
      <div className='container'>
        <Header />
        <Main />
        <Footer />
      </div>
    </div>
  );
}

export default App;
