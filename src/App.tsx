import { BrowserRouter } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Services from './components/Services';
import Shop from './components/Shop';
import Footer from './components/Footer';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="page-content">
        <Navbar />
        <main>
          <Hero />
          <Services />
          <Shop />
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
