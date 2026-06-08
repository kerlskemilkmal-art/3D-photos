/* ==========================================================================
   3D by kero - Main Application Logic
   ========================================================================== */

// 1. Gallery Data Definitions
const imageData = [
    {
        url: 'assets/cyberpunk_city.png',
        title: 'Neon Nexus Street',
        category: 'Cyberpunk Art',
        desc: 'A vibrant representation of a cyberpunk metropolis street at night. Towering skyscrapers, glowing advertisements, rain-slicked concrete, and flying traffic elements represent the intersection of high tech and low life.'
    },
    {
        url: 'assets/neon_geometry.png',
        title: 'Prismatic Geometries',
        category: 'Abstract 3D',
        desc: 'An exploration of physics and refraction in virtual space. Prisms, spheres, and glass toruses floating in a cosmic void, catching rays of colored light and creating complex reflection patterns.'
    },
    {
        url: 'assets/space_island.png',
        title: 'Observatory Oasis',
        category: 'Fantasy Realism',
        desc: 'A surreal celestial sanctuary floating in deep space. Cascading waterfalls flow off the grassy shores into the dark cosmos, illuminated by planetary rings and active gaseous nebulae.'
    },
    {
        url: 'assets/bioluminescent_forest.png',
        title: 'Whispering Flora',
        category: 'Mystical Landscape',
        desc: 'A dreamy bioluminescent forest under a clear starry sky. Glowing mycelium structures, shimmering flora, and a winding electric river cast magical neon light into the deep, dark woodland.'
    }
];

// 2. State Management Variables
let scene, camera, renderer, controls;
let galleryGroup;
let imageMeshes = [];
let particles;
let activeLayout = 'carousel'; // carousel, helix, grid
let isInspecting = false;
let isMouseOverUI = false;
let currentHoveredCard = null;

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// Default camera coordinates for standard view reset
const defaultCameraPos = new THREE.Vector3(0, 0, 8.5);
const defaultCameraTarget = new THREE.Vector3(0, 0, 0);

// Camera layouts configurations
const layoutCamConfigs = {
    carousel: { pos: new THREE.Vector3(0, 0, 8.5), target: new THREE.Vector3(0, 0, 0) },
    helix: { pos: new THREE.Vector3(0, 1.2, 8.5), target: new THREE.Vector3(0, 0, 0) },
    grid: { pos: new THREE.Vector3(0, 0, 7.5), target: new THREE.Vector3(0, 0, 0) }
};

// 3. Initialize Application
function init() {
    // Canvas selection
    const canvas = document.querySelector('#webgl');

    // Create Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0914, 0.04); // subtle depth fog matching background

    // Create Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.copy(defaultCameraPos);

    // Create Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Create Controls (OrbitControls)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.enablePan = false; // keep focus on center art

    // Setup Lighting
    setupLighting();

    // Create Floating Starfield Backdrop
    createStarfield();

    // Load Assets & Create Gallery Cards
    loadGalleryAssets();

    // Setup UI DOM Event Listeners
    setupUIEventListeners();

    // Start Animation Loop
    tick();

    // Handle Window Resizing
    window.addEventListener('resize', onWindowResize);
}

// 4. Lighting Rig
function setupLighting() {
    // Ambient Light to keep assets visible
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Cyan Studio Point Light
    const lightCyan = new THREE.PointLight(0x00ffff, 2.5, 18);
    lightCyan.position.set(-6, 3, 5);
    scene.add(lightCyan);

    // Magenta Studio Point Light
    const lightMagenta = new THREE.PointLight(0xff00ff, 2.5, 18);
    lightMagenta.position.set(6, -3, 5);
    scene.add(lightMagenta);
}

// 5. Starfield / Particles Backdrop
function createStarfield() {
    const particleCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 30; // disperse in a 30x30x30 cube
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Programmatic glowing circular particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(0, 255, 255, 0.8)'); // subtle cyan glow
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    const starTexture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
        size: 0.12,
        map: starTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

// 6. Load Assets and Setup Gallery Groups
function loadGalleryAssets() {
    // Gallery Group is the parent of all image panels
    galleryGroup = new THREE.Group();
    scene.add(galleryGroup);

    // Loading manager handles UI transition
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = () => {
        // Fade out loader once assets are loaded
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.add('fade-out');
        }
    };

    const textureLoader = new THREE.TextureLoader(loadingManager);

    // Image Geometry (Aspect Ratio 1.6 - 16:10 ratio)
    const imgGeo = new THREE.PlaneGeometry(3.2, 2.0);
    // Bezel Backing Frame Geometry (Slightly larger than the image plane)
    const frameGeo = new THREE.PlaneGeometry(3.28, 2.08);
    
    // Framed panel material
    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x161324,
        roughness: 0.1,
        metalness: 0.85,
        side: THREE.DoubleSide
    });

    imageData.forEach((data, index) => {
        const texture = textureLoader.load(data.url);
        // Correct color space for high-quality representation
        texture.encoding = THREE.sRGBEncoding;

        // Image Material
        const imgMat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.35,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        // Create Container Card Group
        const card = new THREE.Group();
        card.name = "card";
        card.userData = {
            index: index,
            title: data.title,
            category: data.category,
            desc: data.desc
        };

        // Create Mesh Planes
        const imgMesh = new THREE.Mesh(imgGeo, imgMat);
        imgMesh.name = "image";
        
        const frameMesh = new THREE.Mesh(frameGeo, frameMat.clone());
        frameMesh.name = "frame";
        frameMesh.position.z = -0.015; // place just behind the image
        frameMesh.receiveShadow = true;
        frameMesh.castShadow = true;

        // Add to card group
        card.add(imgMesh);
        card.add(frameMesh);

        // Compute initial coordinates based on starting layout (Carousel)
        const target = getLayoutPositionAndRotation('carousel', index, imageData.length);
        card.position.copy(target.pos);
        card.rotation.copy(target.rot);

        // Store references
        imageMeshes.push(card);
        galleryGroup.add(card);
    });
}

// 7. Layout Position Generators
function getLayoutPositionAndRotation(layout, index, total) {
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();

    if (layout === 'carousel') {
        const radius = 4.2;
        const angle = (index / total) * Math.PI * 2;
        
        pos.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        rot.set(0, angle, 0); // Face outwards from central axis
    } 
    else if (layout === 'helix') {
        const radius = 3.6;
        const angle = (index / total) * Math.PI * 2.5; // Spiral spread
        
        pos.set(
            Math.sin(angle) * radius,
            (index - (total - 1) / 2) * 1.3, // Vertically distributed
            Math.cos(angle) * radius
        );
        rot.set(0, angle, 0);
    } 
    else if (layout === 'grid') {
        const colSpacing = 3.8;
        const rowSpacing = 2.4;
        const cols = 2;
        
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        pos.set(
            (col - 0.5) * colSpacing,
            -(row - 0.5) * rowSpacing,
            0
        );
        rot.set(0, 0, 0); // Flat-facing forward
    }

    return { pos, rot };
}

// 8. Interaction & Raycasting (Hover state)
function handleRaycast() {
    // If user is hovering over UI elements or is inspecting details, skip 3D hover actions
    if (isMouseOverUI || isInspecting) {
        if (currentHoveredCard) resetHover();
        return;
    }

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(galleryGroup.children, true);

    if (intersects.length > 0) {
        // Find the root 'card' Group node
        let obj = intersects[0].object;
        while (obj && obj.name !== "card" && obj.parent) {
            obj = obj.parent;
        }

        if (obj && obj.name === "card") {
            if (currentHoveredCard !== obj) {
                // Remove hover from previous
                if (currentHoveredCard) resetHover();

                // Assign current hovered
                currentHoveredCard = obj;
                document.body.style.cursor = 'pointer';

                // GSAP smooth scaling and moving card slightly forward on its local normal
                gsap.to(currentHoveredCard.scale, { x: 1.08, y: 1.08, z: 1.08, duration: 0.35, ease: "power2.out" });
                
                // Light up the frame with a cyan/purple glow
                const frame = currentHoveredCard.getObjectByName("frame");
                if (frame && frame.material) {
                    gsap.to(frame.material.emissive, { r: 0.12, g: 0.08, b: 0.22, duration: 0.3 });
                }
            }
        }
    } else {
        if (currentHoveredCard) resetHover();
    }
}

function resetHover() {
    if (currentHoveredCard) {
        gsap.to(currentHoveredCard.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.35, ease: "power2.out" });
        
        const frame = currentHoveredCard.getObjectByName("frame");
        if (frame && frame.material) {
            gsap.to(frame.material.emissive, { r: 0, g: 0, b: 0, duration: 0.3 });
        }
        
        currentHoveredCard = null;
        document.body.style.cursor = 'default';
    }
}

// 9. Inspect Gallery Card (Camera Zoom)
function inspectImage(card) {
    isInspecting = true;
    resetHover();

    // Disable OrbitControls during initial translation transition
    controls.enabled = false;

    // Retrieve card global position and orientation
    const cardPos = new THREE.Vector3();
    card.getWorldPosition(cardPos);

    const cardQuat = new THREE.Quaternion();
    card.getWorldQuaternion(cardQuat);

    // Calculate normal vector (facing forward out of plane)
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(cardQuat);

    // Target position is 4.0 units away from the center of the card
    const targetCamPos = cardPos.clone().add(normal.clone().multiplyScalar(4.0));

    // Fill Sidebar Detail UI
    document.getElementById('detail-title').innerText = card.userData.title;
    document.getElementById('detail-category').innerText = card.userData.category;
    document.getElementById('detail-desc').innerText = card.userData.desc;

    // Slide in the detail panel sidebar
    const panel = document.getElementById('detail-panel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    // Camera Translation Zoom
    gsap.to(camera.position, {
        x: targetCamPos.x,
        y: targetCamPos.y,
        z: targetCamPos.z,
        duration: 1.5,
        ease: "power3.out"
    });

    // Animate orbit controls anchor point to the center of the image mesh
    gsap.to(controls.target, {
        x: cardPos.x,
        y: cardPos.y,
        z: cardPos.z,
        duration: 1.5,
        ease: "power3.out",
        onComplete: () => {
            // Re-enable controls, allowing subtle orbits around inspect center
            controls.enabled = true;
        }
    });
}

function closeInspection() {
    controls.enabled = false;

    // Slide out the detail sidebar panel
    const panel = document.getElementById('detail-panel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');

    // Return camera and orbital target coordinates to the current layout defaults
    const camConfig = layoutCamConfigs[activeLayout];

    gsap.to(camera.position, {
        x: camConfig.pos.x,
        y: camConfig.pos.y,
        z: camConfig.pos.z,
        duration: 1.5,
        ease: "power3.out"
    });

    gsap.to(controls.target, {
        x: camConfig.target.x,
        y: camConfig.target.y,
        z: camConfig.target.z,
        duration: 1.5,
        ease: "power3.out",
        onComplete: () => {
            controls.enabled = true;
            isInspecting = false; // Resume background rotations
        }
    });
}

// 10. Switch Active Layout Mode
function switchLayout(layoutName) {
    if (activeLayout === layoutName && !isInspecting) return;

    activeLayout = layoutName;
    isInspecting = false;
    controls.enabled = false;

    // Slide out detail panel if open
    const panel = document.getElementById('detail-panel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');

    // Reset gallery orientation to Y=0 to align animations neatly
    gsap.to(galleryGroup.rotation, {
        y: 0,
        x: 0,
        z: 0,
        duration: 1.2,
        ease: "power2.inOut"
    });

    // Animate image cards coordinates
    imageMeshes.forEach((card, index) => {
        const target = getLayoutPositionAndRotation(layoutName, index, imageMeshes.length);

        gsap.to(card.position, {
            x: target.pos.x,
            y: target.pos.y,
            z: target.pos.z,
            duration: 1.4,
            ease: "power3.inOut"
        });

        gsap.to(card.rotation, {
            x: target.rot.x,
            y: target.rot.y,
            z: target.rot.z,
            duration: 1.4,
            ease: "power3.inOut"
        });
    });

    // Transition camera coordinates to default positions of this layout
    const camConfig = layoutCamConfigs[layoutName];

    gsap.to(camera.position, {
        x: camConfig.pos.x,
        y: camConfig.pos.y,
        z: camConfig.pos.z,
        duration: 1.4,
        ease: "power3.inOut"
    });

    gsap.to(controls.target, {
        x: camConfig.target.x,
        y: camConfig.target.y,
        z: camConfig.target.z,
        duration: 1.4,
        ease: "power3.inOut",
        onComplete: () => {
            controls.enabled = true;
        }
    });
}

// 11. Handle UI Event Listeners
function setupUIEventListeners() {
    // Pointer actions over UI (blocks raycasting behind buttons/navbar/panels)
    window.addEventListener('mousemove', (event) => {
        if (event.target.id !== 'webgl') {
            isMouseOverUI = true;
            document.body.style.cursor = 'default';
            resetHover();
            return;
        }
        isMouseOverUI = false;

        // Map client coordinates to normalized WebGL coordinates (-1 to 1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Click trigger for inspect mesh
    window.addEventListener('click', (event) => {
        if (event.target.id !== 'webgl' || isInspecting) return;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(galleryGroup.children, true);

        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj && obj.name !== "card" && obj.parent) {
                obj = obj.parent;
            }

            if (obj && obj.name === "card") {
                inspectImage(obj);
            }
        }
    });

    // Close panel trigger
    document.getElementById('btn-close-detail').addEventListener('click', closeInspection);

    // Layout buttons bindings
    const layoutButtons = document.querySelectorAll('.btn-layout');
    layoutButtons.forEach(btn => {
        btn.addEventListener('click', (event) => {
            layoutButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const selectedLayout = btn.getAttribute('data-layout');
            switchLayout(selectedLayout);
        });
    });

    // Modal navigation
    const aboutModal = document.getElementById('about-modal');
    document.getElementById('nav-about').addEventListener('click', (e) => {
        e.preventDefault();
        aboutModal.classList.add('open');
        aboutModal.setAttribute('aria-hidden', 'false');
    });

    document.getElementById('btn-close-about').addEventListener('click', () => {
        aboutModal.classList.remove('open');
        aboutModal.setAttribute('aria-hidden', 'true');
    });

    aboutModal.addEventListener('click', (e) => {
        if (e.target === aboutModal) {
            aboutModal.classList.remove('open');
            aboutModal.setAttribute('aria-hidden', 'true');
        }
    });

    document.getElementById('nav-gallery').addEventListener('click', (e) => {
        e.preventDefault();
        if (isInspecting) {
            closeInspection();
        }
    });
}

// 12. Animation Tick Loop
function tick() {
    // Update Orbit Controls (damping requires updates)
    controls.update();

    // Perform Raycasting hover checks
    handleRaycast();

    // Slowly rotate starfield particles background
    if (particles) {
        particles.rotation.y += 0.0006;
        particles.rotation.x += 0.0003;
    }

    // Auto-rotate the gallery cards if not inspecting and in carousel/helix layouts
    const shouldRotate = !isInspecting && (activeLayout === 'carousel' || activeLayout === 'helix');
    if (shouldRotate && galleryGroup) {
        galleryGroup.rotation.y += 0.003;
    }

    // Render Scene
    renderer.render(scene, camera);

    // Call next frame
    window.requestAnimationFrame(tick);
}

// 13. Screen Resize Event Handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// 14. Initialize App on DOM Load
window.addEventListener('DOMContentLoaded', () => {
    init();
});
