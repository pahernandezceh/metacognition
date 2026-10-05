// Colours. Frame colours are a categorical palette validated (all pairs,
// against the paper surface) for the first five slots; the sixth sits in the
// CVD warn band and from the seventh on hues repeat, so a frame is never
// identified by colour alone: its number travels with it everywhere.

export const PALETTE = {
  paper: '#f5f2ec',
  ink: '#1f1b17',
  muted: '#7d7365',
  accent: '#c84b2f',
  shadow: '#4f4740',
  hatch: '#5f564d',
};

export const FRAME_COLORS = ['#2a78d6', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#1baf7a', '#eb6834', '#e34948'];

export const frameColor = slot => FRAME_COLORS[((slot % FRAME_COLORS.length) + FRAME_COLORS.length) % FRAME_COLORS.length];
