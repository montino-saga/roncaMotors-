// Muelles del sistema. Traducción de damping ratio + response (Apple) a la API
// de Framer: bounce 0 = críticamente amortiguado, duration = response.
// El rebote se reserva a lo que el usuario ha empujado con el dedo.

export const SPRING = { type: "spring", bounce: 0, duration: 0.4 };      // reposicionar
export const SPRING_SNAPPY = { type: "spring", bounce: 0, duration: 0.28 }; // aparecer
export const SPRING_MOMENTUM = { type: "spring", bounce: 0.2, duration: 0.3 }; // gesto

// Feedback de pulsación: dispara en pointer-down, no al soltar.
export const PRESS = "transition-transform duration-100 ease-out active:scale-[0.97]";
