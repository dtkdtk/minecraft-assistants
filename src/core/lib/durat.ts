export function Durat(time: { ms?: number; sec?: number; min?: number; hr?: number; day?: number }): number {
  let R = 0;
  if (time.day) R += time.day * 1000 * 60 * 60 * 24;
  if (time.hr) R += time.hr * 1000 * 60 * 60;
  if (time.min) R += time.min * 1000 * 60;
  if (time.sec) R += time.sec * 1000;
  if (time.ms) R += time.ms;
  return R;
}
