import { getConfig } from './config';

describe('getConfig', () => {
  afterEach(() => {
    // Reset environment variables after each test
    delete process.env.SMOKE_RATE;
    delete process.env.SMOKE_DURATION;
    delete process.env.AVERAGE_RATE;
    delete process.env.AVERAGE_DURATION;
    delete process.env.STRESS_RATE;
    delete process.env.STRESS_DURATION;
    delete process.env.SOAK_RATE;
    delete process.env.SOAK_DURATION;
    delete process.env.SPIKE_RATE;
    delete process.env.SPIKE_DURATION;
    delete process.env.BREAKPOINT_RATE;
  });

  test('should return default values when no environment variables are set', () => {
    const config = getConfig();
    expect(config).toEqual({
      smoke: { rate: 0.99, duration: 600 },
      average: { rate: 0.99, duration: 800 },
      stress: { rate: 0.99, duration: 1600 },
      soak: { rate: 0.99, duration: 800 },
      spike: { rate: 0.99, duration: 3200 },
      breakpoint: { rate: 0.99 },
    });
  });

  test('should correctly parse environment variables for smoke', () => {
    process.env.SMOKE_RATE = '0.95';
    process.env.SMOKE_DURATION = '500';

    const config = getConfig();
    expect(config.smoke).toEqual({ rate: 0.95, duration: 500 });
  });

  test('should correctly parse environment variables for average', () => {
    process.env.AVERAGE_RATE = '0.90';
    process.env.AVERAGE_DURATION = '1000';

    const config = getConfig();
    expect(config.average).toEqual({ rate: 0.90, duration: 1000 });
  });

  test('should correctly parse environment variables for stress', () => {
    process.env.STRESS_RATE = '0.80';
    process.env.STRESS_DURATION = '2000';

    const config = getConfig();
    expect(config.stress).toEqual({ rate: 0.80, duration: 2000 });
  });

  test('should correctly parse environment variables for soak', () => {
    process.env.SOAK_RATE = '0.85';
    process.env.SOAK_DURATION = '1500';

    const config = getConfig();
    expect(config.soak).toEqual({ rate: 0.85, duration: 1500 });
  });

  test('should correctly parse environment variables for spike', () => {
    process.env.SPIKE_RATE = '0.70';
    process.env.SPIKE_DURATION = '4000';

    const config = getConfig();
    expect(config.spike).toEqual({ rate: 0.70, duration: 4000 });
  });

  test('should correctly parse environment variables for breakpoint', () => {
    process.env.BREAKPOINT_RATE = '0.60';

    const config = getConfig();
    expect(config.breakpoint).toEqual({ rate: 0.60 });
  });

  test('should handle mixed environment variable settings and defaults', () => {
    process.env.SMOKE_RATE = '0.93';
    process.env.AVERAGE_DURATION = '1200';

    const config = getConfig();
    expect(config.smoke).toEqual({ rate: 0.93, duration: 600 });
    expect(config.average).toEqual({ rate: 0.99, duration: 1200 });
    expect(config.stress).toEqual({ rate: 0.99, duration: 1600 });
  });
});
