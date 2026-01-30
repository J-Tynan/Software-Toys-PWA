// Minimal helpers for particle drawing and transforms
export function drawParticles(ctx, particles = []) {
  if (!ctx) return;
  ctx.save();
  particles.forEach(p => {
    ctx.fillStyle = p.color || 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius || 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// TODO: add coordinate transforms, spawn utilities, physics integrator
