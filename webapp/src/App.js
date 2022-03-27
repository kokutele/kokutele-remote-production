import { Button } from 'antd'

import './App.css';

function App() {
  return (
    <div className="App">
      <div className="container">
        <h1>kokutele remote production</h1>
        <Button onClick={() => alert(0)}>Click</Button>
      </div>
    </div>
  );
}

export default App;
