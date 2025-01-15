// config.js
export function getConfig() {
    return {
      smoke: {
        rate: parseFloat(__ENV.SMOKE_RATE || "0.99"),
        duration: parseInt(__ENV.SMOKE_DURATION || "600"),
      },
      average: {
        rate: parseFloat(__ENV.AVERAGE_RATE || "0.99"),
        duration: parseInt(__ENV.AVERAGE_DURATION || "800"),
      },
      stress: {
        rate: parseFloat(__ENV.STRESS_RATE || "0.99"),
        duration: parseInt(__ENV.STRESS_DURATION || "1600"),
      },
      soak: {
        rate: parseFloat(__ENV.SOAK_RATE || "0.99"),
        duration: parseInt(__ENV.SOAK_DURATION || "800"),
      },
      spike: {
        rate: parseFloat(__ENV.SPIKE_RATE || "0.99"),
        duration: parseInt(__ENV.SPIKE_DURATION || "3200"),
      },
      breakpoint: {
        rate: parseFloat(__ENV.BREAKPOINT_RATE || "0.99"),
      },
    };
  }
  