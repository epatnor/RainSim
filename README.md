# 🌧️ RainSim

**RainSim** är ett litet projekt som kombinerar **Three.js** och **FastAPI** för att simulera regn, blöta ytor och andra väderrelaterade effekter – styrt via ett snyggt webb-GUI.

Perfekt för dig som:
- Gillar regn men hatar att bli blöt.
- Vill testa shaders utan att skriva en hel spelmotor.
- Behöver en ursäkt för att använda ordet *"wetness"* i seriösa sammanhang.

---

## ✨ Funktioner

- **Interaktivt GUI** – ändra tid på dygnet, regnintensitet, molnighet, m.m. i realtid.
- **Screen-space regn** – regnstreck renderade ovanpå scenen.
- **Blöta material** – ytor blir mörkare och mer blanka när det regnar.
- **FastAPI-backend** – API för att hämta/sätta scenparametrar.
- **HTML + Three.js frontend** – inga bundlers, bara öppna i webbläsaren.

---

## 🚀 Installation

Kräver **Python 3.9+**.

```bash
git clone https://github.com/epatnor/RainSim.git
cd RainSim
pip install fastapi uvicorn
