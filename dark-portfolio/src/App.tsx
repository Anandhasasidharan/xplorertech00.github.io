import { useState } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Hero from "./components/Hero";
import SelectedWorks from "./components/SelectedWorks";
import Journal from "./components/Journal";
import SecurityLab from "./components/SecurityLab";
import CalendarSection from "./components/CalendarSection";
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
        <SecurityLab />
        <Explorations />
        <Stats />
        <CalendarSection />
        <Contact />
      </main>
    </>
  );
}

export default App;
