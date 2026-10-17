(function () {
    'use strict';

    /* ====================================================
       PHASE 3: GSAP PORTFOLIO HORIZONTAL SCROLL-JACKING
       ==================================================== */
    function initPortfolioGSAP() {
        // GSAP Scroll-Jacking enabled on all devices
        
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        gsap.registerPlugin(ScrollTrigger);

        var pin = document.getElementById('portfolio-pin');
        var track = document.getElementById('portfolio-track');
        if (!pin || !track) return;

        var dist = () => track.scrollWidth - window.innerWidth;

        gsap.to(track, {
            x: () => -dist(),
            ease: 'none',
            scrollTrigger: {
                trigger: pin,
                start: 'top top',
                end: () => '+=' + dist(),
                pin: true,
                scrub: 1,
                invalidateOnRefresh: true,
                anticipatePin: 1
            }
        });
    }

    /* ====================================================
       PHASE 2: WEBGL LENS CURSOR
       ==================================================== */
    function initWebGLHero() {
        // Disable WebGL lens on mobile touch devices
        if (window.innerWidth < 768) return;
        
        var canvas = document.getElementById('hero-canvas');
        var hero = document.getElementById('hero');
        
        if (!canvas || !hero || typeof THREE === 'undefined') {
            document.querySelector('.hero-content h1').style.opacity = '1';
            document.querySelector('.hero-content p').style.opacity = '1';
            return;
        }

        // Hide fallback HTML text since we'll draw it in WebGL
        document.querySelector('.hero-content h1').style.opacity = '0';
        document.querySelector('.hero-content p').style.opacity = '0';

        var W = hero.offsetWidth;
        var H = hero.offsetHeight;

        var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0); // Transparent so CSS fluid bg shows through
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(W, H);

        var scene = new THREE.Scene();
        var camera = new THREE.OrthographicCamera(-W/2, W/2, H/2, -H/2, 0.1, 10);
        camera.position.z = 1;

        // Render text to an invisible 2D canvas texture
        var tc = document.createElement('canvas');
        var tctx = tc.getContext('2d');
        
        function buildText() {
            var dpr = Math.min(window.devicePixelRatio, 2);
            tc.width = W * dpr;
            tc.height = H * dpr;
            var cx = tc.width / 2;
            var cy = tc.height / 2;
            
            var titlePx = Math.min(W * 0.1, 120) * dpr;
            var tagPx = Math.min(W * 0.017, 20) * dpr;

            tctx.clearRect(0, 0, tc.width, tc.height);
            
            tctx.textAlign = 'center';
            tctx.textBaseline = 'middle';
            tctx.fillStyle = '#ffffff';
            tctx.font = '900 ' + titlePx + 'px Inter, sans-serif';
            tctx.fillText('VANTAGESTACK', cx, cy - titlePx * 0.3);

            tctx.font = '400 ' + tagPx + 'px Inter, sans-serif';
            tctx.fillStyle = 'rgba(255,255,255,0.8)';
            tctx.letterSpacing = (tagPx * 0.3) + 'px';
            tctx.fillText('CONSTRUYE. AUTOMATIZA. POSICIONA.', cx, cy + titlePx * 0.65);
        }
        buildText();

        var tex = new THREE.CanvasTexture(tc);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;

        // Passthrough vertex shader
        var vert = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        // Fragment Shader: Lens Distortion & Chromatic Aberration
        var frag = `
            precision highp float;
            uniform sampler2D u_text;
            uniform vec2 u_mouse;
            uniform vec2 u_res;
            uniform float u_radius;
            uniform float u_strength;
            varying vec2 vUv;

            void main() {
                vec2 uv = vUv;
                float aspect = u_res.x / u_res.y;
                vec2 d = (uv - u_mouse) * vec2(aspect, 1.0);
                float dist = length(d);

                if (dist < u_radius) {
                    float norm = dist / u_radius;
                    
                    // Barrel magnification
                    float pull = u_strength * pow(1.0 - norm, 2.0) * 0.2;
                    vec2 du = d / vec2(aspect, 1.0);
                    vec2 dUv = uv - du * pull;

                    // Chromatic aberration based on distance from cursor
                    float ca = 0.015 * (1.0 - norm);
                    vec2 caV = normalize(d) / vec2(aspect, 1.0) * ca;

                    float r = texture2D(u_text, dUv + caV).r;
                    float g = texture2D(u_text, dUv).g;
                    float b = texture2D(u_text, dUv - caV).b;
                    float a = max(texture2D(u_text, dUv + caV).a, max(texture2D(u_text, dUv).a, texture2D(u_text, dUv - caV).a));

                    // Glass highlight rim
                    float rim = smoothstep(0.85, 1.0, norm);
                    
                    // Darken interior slightly to create glass effect
                    vec3 col = vec3(r,g,b) + vec3(0.05, 0.05, 0.1) * (1.0 - norm) * 0.5;
                    col = mix(col, vec3(1.0, 1.0, 1.0), rim * 0.4);

                    // Emulate the glass alpha
                    float glassAlpha = max(a, (1.0 - norm) * 0.1 + rim * 0.3);
                    
                    gl_FragColor = vec4(col, glassAlpha);
                } else {
                    gl_FragColor = texture2D(u_text, uv);
                }
            }
        `;

        var mat = new THREE.ShaderMaterial({
            uniforms: {
                u_text: { value: tex },
                u_mouse: { value: new THREE.Vector2(2.0, 2.0) }, // Start offscreen
                u_res: { value: new THREE.Vector2(W, H) },
                u_radius: { value: 0.15 },
                u_strength: { value: 1.0 }
            },
            vertexShader: vert,
            fragmentShader: frag,
            transparent: true
        });

        var mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
        scene.add(mesh);

        var tM = new THREE.Vector2(2.0, 2.0); // Target Mouse
        var cM = new THREE.Vector2(2.0, 2.0); // Current Mouse (lerped)

        hero.addEventListener('mousemove', function(e) {
            var r = canvas.getBoundingClientRect();
            tM.set(
                (e.clientX - r.left) / r.width,
                1.0 - (e.clientY - r.top) / r.height
            );
        });
        hero.addEventListener('mouseleave', function() {
            tM.set(2.0, 2.0); // push lens offscreen
        });

        function tick() {
            requestAnimationFrame(tick);
            cM.x += (tM.x - cM.x) * 0.08;
            cM.y += (tM.y - cM.y) * 0.08;
            mat.uniforms.u_mouse.value.copy(cM);
            renderer.render(scene, camera);
        }
        tick();

        window.addEventListener('resize', function() {
            if (window.innerWidth < 768) return;
            W = hero.offsetWidth;
            H = hero.offsetHeight;
            renderer.setSize(W, H);
            camera.left = -W/2; camera.right = W/2;
            camera.top = H/2; camera.bottom = -H/2;
            camera.updateProjectionMatrix();
            mat.uniforms.u_res.value.set(W, H);
            mesh.geometry.dispose();
            mesh.geometry = new THREE.PlaneGeometry(W, H);
            buildText();
            tex.needsUpdate = true;
            if(typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        });
    }

    /* ====================================================
       PHASE 4: ECOSYSTEM LOGOS HOVER/MOBILE LOGIC
       ==================================================== */
    function initEcosystemLogos() {
        // Target only <img> tags so we don't try to manipulate the inline SVGs
        var icons = document.querySelectorAll('img.partner-icon');
        if (!icons) return;

        var isMobile = window.innerWidth < 768;

        // Set initial state
        icons.forEach(function(icon) {
            var graySrc = icon.getAttribute('data-gray-src');
            var colorSrc = icon.getAttribute('data-color-src');

            if (isMobile) {
                icon.src = colorSrc;
            } else {
                icon.src = graySrc;
            }

            // Desktop hover swap listeners (pure JS src swapping)
            icon.addEventListener('mouseenter', function() {
                if (window.innerWidth >= 768) icon.src = colorSrc;
            });
            icon.addEventListener('mouseleave', function() {
                if (window.innerWidth >= 768) icon.src = graySrc;
            });
        });

        // Handle viewport resize to dynamically reset correct sources
        window.addEventListener('resize', function() {
            var nowMobile = window.innerWidth < 768;
            if (nowMobile !== isMobile) {
                isMobile = nowMobile;
                icons.forEach(function(icon) {
                    if (isMobile) {
                        icon.src = icon.getAttribute('data-color-src');
                    } else {
                        icon.src = icon.getAttribute('data-gray-src');
                    }
                });
            }
        });
    }

    // Init scripts after all resources are fetched
    window.addEventListener('load', function () {
        initPortfolioGSAP();
        initEcosystemLogos();
        initWebGLHero();
    });

    // Run preloader dismissal directly (not waiting for load event) 
    // to guarantee the fast 1.8s cut requirement.
    var preloader = document.getElementById('preloader');
    if (preloader) {
        setTimeout(function() {
            preloader.classList.add('done');
        }, 1800);
    }

})();
