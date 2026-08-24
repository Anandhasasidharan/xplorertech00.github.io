import { useState } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Hero from "./components/Hero";
import SelectedWorks from "./components/SelectedWorks";
import Journal from "./components/Journal";
import Explorations from "./components/Explorations";
import Stats from "./components/Stats";
import Contact from "./components/Contact";

function App() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}
      <main className="bg-bg">
        <Hero />
        <SelectedWorks />
        <Journal />
        <Explorations />
        <Stats />
        <Contact />
      </main>
    </>
  );
}

export default App;
