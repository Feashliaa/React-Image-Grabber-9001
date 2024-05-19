import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="container">
      <h1>Interact with the Button</h1>
      <div className="card">
        <button onClick={() => setCount(count + 1)}>
          Click me! Count: {count}
        </button>
      </div>
    </div>
  );
}


export default App;
