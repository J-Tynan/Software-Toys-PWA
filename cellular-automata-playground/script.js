document.addEventListener('DOMContentLoaded', () => {
    loadGlobalTheme(); // Add this as the FIRST line inside the listener
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    // Resize canvas to full screen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Your logic here (e.g., draw fractal)

    // Demo mode button
    document.getElementById('demo-btn').addEventListener('click', () => {
        // Start auto-demo
    });

    // Animation loop
    function animate() {
        // Update and draw
        requestAnimationFrame(animate);
    }
    animate();
});
