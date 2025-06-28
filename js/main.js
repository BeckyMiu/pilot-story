// main.js (完整替换此文件)

document.addEventListener("DOMContentLoaded", () => {
    gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
    Chart.register(ChartDataLabels);

    let scene, camera, renderer, particles, noise;
    let clock = new THREE.Clock();
    let isFunnelAnimating = false;
    const funnelData = [
        { "process": "注册报名", "in": 44603, "out": 44603 },
        { "process": "预选初检", "in": 44603, "out": 24130 },
        { "process": "体格复检", "in": 24130, "out": 8305 },
        { "process": "高考录取", "in": 7786, "out": 2856 },
        { "process": "入校复查", "in": 2856, "out": 2713 }
    ];
    const PARTICLE_COUNT = funnelData[0].in;
    let targetPositions = {};
    let canvasWrapper; 

    function initChapterNav() {
        const navItems = document.querySelectorAll('#chapter-nav li');
        if (navItems.length === 0) return;
        navItems.forEach(item => {
            const sectionId = item.dataset.navId;
            const section = document.getElementById(sectionId);
            if (!section) return;
            ScrollTrigger.create({
                trigger: section,
                start: "top center",
                end: "bottom center",
                onToggle: self => {
                    if (self.isActive) {
                        navItems.forEach(i => i.classList.remove('is-active'));
                        item.classList.add('is-active');
                    }
                }
            });
        });
    }
       
    function initHeroAnimation() {
        const heroFrames = gsap.utils.toArray(".hero-frame");
        const heroContent = document.querySelector(".hero-content");
        const heroTl = gsap.timeline({ scrollTrigger: { trigger: "#hero-scroll-wrapper", start: "top top", end: "bottom bottom", scrub: 1, pin: "#hero", anticipatePin: 1 } });
        heroTl.to(heroContent, { opacity: 0, ease: "power1.in" }, 0);
        heroTl.to(heroFrames[0], { opacity: 0, ease: 'none' }, 0);
        heroTl.to(heroFrames[1], { opacity: 1, ease: 'none' }, 0);
        heroTl.to(heroFrames[1], { opacity: 0, ease: 'none' }, 0.8);
        heroTl.to(heroFrames[2], { opacity: 1, ease: 'none' }, 0.8);
    }
    
    function initSideDecorations() {
        const planeGroup = document.getElementById('progress-plane-group');
        if (!planeGroup) return;
        gsap.to(planeGroup, { scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 1, }, motionPath: { path: "#flight-path", align: "#flight-path", alignOrigin: [0.5, 0.5], autoRotate: true }, ease: "none" });
    }

    function initFunnelVisualization() {
        const canvas = document.getElementById('particle-canvas');
        canvasWrapper = document.getElementById('funnel-canvas-wrapper'); 
        if (!canvas || !canvasWrapper) return;
        if (typeof THREE === 'undefined' || typeof SimplexNoise === 'undefined') {
            console.error("Three.js or SimplexNoise is not loaded. Funnel visualization cannot start.");
            return;
        }
        noise = new SimplexNoise();
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, canvasWrapper.clientWidth / canvasWrapper.clientHeight, 0.1, 1000);
        camera.position.set(0, 0, 80);
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(canvasWrapper.clientWidth, canvasWrapper.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        createParticles();
        calculateAllTargetStates();
        setParticlesToInitialState('halo');
        setupFunnelScrollAnimation();
        animateFunnel();
        window.addEventListener('resize', onWindowResize);
    }
    
    function createParticles() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const colors = new Float32Array(PARTICLE_COUNT * 3);
        const goldColor = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim());
        for (let i = 0; i < PARTICLE_COUNT; i++) { goldColor.toArray(colors, i * 3); }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7, depthWrite: false });
        particles = new THREE.Points(geometry, material);
        scene.add(particles);
    }
    
    function calculateAllTargetStates() {
        targetPositions = {};
        const Y_START = 35, Y_STEP = -18, X_WIDTH_MAX = 120, Z_DEPTH = 20, Z_DISAPPEAR = -1000;
        targetPositions.halo = new Float32Array(PARTICLE_COUNT * 3);
        const haloRadius = 60, haloThickness = 20, haloHeight = 5;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = haloRadius + (Math.random() - 0.5) * haloThickness;
            targetPositions.halo[i * 3] = Math.cos(angle) * radius;
            targetPositions.halo[i * 3 + 1] = (Math.random() - 0.5) * haloHeight;
            targetPositions.halo[i * 3 + 2] = Math.sin(angle) * radius;
        }
        const shuffledIndices = Array.from({ length: PARTICLE_COUNT }, (_, i) => i);
        for (let i = shuffledIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
        }
        funnelData.forEach((stage, stageIndex) => {
            const positions = new Float32Array(PARTICLE_COUNT * 3);
            const survivorCount = stage.out;
            const currentY = Y_START + stageIndex * Y_STEP;
            const widthRatio = stageIndex === 0 ? 1 : survivorCount / funnelData[0].out;
            const currentXWidth = X_WIDTH_MAX * widthRatio;
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const particleIndex = i;
                const shuffledPosition = shuffledIndices.indexOf(particleIndex);
                if (shuffledPosition < survivorCount) {
                    positions[particleIndex * 3] = (Math.random() - 0.5) * currentXWidth;
                    positions[particleIndex * 3 + 1] = currentY + (Math.random() - 0.5) * 4;
                    positions[particleIndex * 3 + 2] = (Math.random() - 0.5) * Z_DEPTH;
                } else {
                    const prevPositions = stageIndex > 0 ? targetPositions[`stage${stageIndex - 1}`] : targetPositions.halo;
                    positions[particleIndex * 3] = prevPositions[particleIndex * 3];
                    positions[particleIndex * 3 + 1] = prevPositions[particleIndex * 3 + 1];
                    positions[particleIndex * 3 + 2] = Z_DISAPPEAR;
                }
            }
            targetPositions[`stage${stageIndex}`] = positions;
        });
        const pyramidPositions = new Float32Array(PARTICLE_COUNT * 3);
        const PYRAMID_Y_CENTER_OFFSET = 15;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const particleIndex = i, shuffledPosition = shuffledIndices.indexOf(particleIndex);
            let lastSurvivedStage = -1;
            for (let j = funnelData.length - 1; j >= 0; j--) { if (shuffledPosition < funnelData[j].out) { lastSurvivedStage = j; break; } }
            if (lastSurvivedStage !== -1) {
                const stage = funnelData[lastSurvivedStage], widthRatio = stage.out / funnelData[0].out;
                const currentXWidth = X_WIDTH_MAX * widthRatio, currentY = (Y_START + lastSurvivedStage * Y_STEP) - PYRAMID_Y_CENTER_OFFSET;
                pyramidPositions[particleIndex * 3] = (Math.random() - 0.5) * currentXWidth;
                pyramidPositions[particleIndex * 3 + 1] = currentY;
                pyramidPositions[particleIndex * 3 + 2] = (Math.random() - 0.5) * Z_DEPTH;
            } else { pyramidPositions[particleIndex * 3 + 2] = Z_DISAPPEAR; }
        }
        targetPositions.pyramid = pyramidPositions;
        const allHiddenPositions = new Float32Array(PARTICLE_COUNT * 3);
        const lastLineState = targetPositions[`stage${funnelData.length - 1}`];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            allHiddenPositions[i * 3] = lastLineState[i * 3];
            allHiddenPositions[i * 3 + 1] = lastLineState[i * 3 + 1];
            allHiddenPositions[i * 3 + 2] = Z_DISAPPEAR;
        }
        targetPositions.allHidden = allHiddenPositions;
    }

    function setParticlesToInitialState(stateKey) {
        if (particles) {
            particles.geometry.attributes.position.array.set(targetPositions[stateKey]);
            particles.geometry.attributes.position.needsUpdate = true;
        }
    }
    
    function setupFunnelScrollAnimation() {
        const masterTimeline = gsap.timeline({ scrollTrigger: { trigger: "#funnel-animation-container", start: "top top", end: "bottom bottom", scrub: 1.5, onUpdate: (self) => { isFunnelAnimating = self.progress > 0.01 && self.progress < 0.98; } } });
        const positionAttribute = particles.geometry.attributes.position;
        const onUpdate = () => { positionAttribute.needsUpdate = true; };
        const finalRevealSection = document.getElementById('final-reveal-section');
        masterTimeline.to(positionAttribute.array, { duration: 2, endArray: targetPositions.stage0, onUpdate }, "start");
        masterTimeline.to("#funnel-text-container", { opacity: 1, duration: 1 }, "start+=0.5");
        funnelData.forEach((stage, index) => {
            const startTime = 1 + index * 2;
            masterTimeline.to(positionAttribute.array, { duration: 1.5, endArray: targetPositions[`stage${index}`], onUpdate }, startTime);
            masterTimeline.call(() => {
                const rate = stage.in > stage.out ? ((stage.in - stage.out) / stage.in * 100) : 0;
                gsap.to("#funnel-text-line1", { duration: 0.3, innerText: stage.process, overwrite: 'auto' });
                gsap.to("#funnel-text-line2", { duration: 0.3, innerText: `剩余: ${stage.out.toLocaleString()}人`, overwrite: 'auto' });
                gsap.to("#funnel-text-line3", { duration: 0.3, innerText: rate > 0 ? `本轮淘汰率: ${rate.toFixed(1)}%` : '', overwrite: 'auto' });
            }, [], startTime);
        });
        const lastLineTime = 1 + (funnelData.length - 1) * 2 + 1.5;
        masterTimeline.to("#funnel-text-container", { opacity: 0, duration: 1 }, lastLineTime);
        masterTimeline.to(positionAttribute.array, { duration: 1, endArray: targetPositions.allHidden, onUpdate }, lastLineTime);
        const pyramidAppearTime = lastLineTime + 1.5;
        masterTimeline.call(() => { particles.material.opacity = 0; setParticlesToInitialState('pyramid'); }, [], pyramidAppearTime);
        masterTimeline.to(particles.material, { duration: 2, opacity: 0.7 }, pyramidAppearTime);
        const textAppearTime = pyramidAppearTime + 1.5;
        masterTimeline.call(() => {
            const initialCount = funnelData[0].in, finalCount = funnelData[funnelData.length - 1].out;
            const totalEliminationRate = ((initialCount - finalCount) / initialCount) * 100;
            finalRevealSection.innerHTML = `<h2>总淘汰率</h2><p>${totalEliminationRate.toFixed(1)}%</p>`;
        }, [], textAppearTime);
        masterTimeline.to(finalRevealSection, { opacity: 1, duration: 1.5 }, textAppearTime);
        const fadeOutTime = textAppearTime + 3;
        masterTimeline.to(particles.material, { opacity: 0, duration: 1.5, ease: "power1.in" }, fadeOutTime);
        masterTimeline.to(finalRevealSection, { opacity: 0, duration: 1.5, ease: "power1.in" }, fadeOutTime);
    }

    function animateFunnel() {
        requestAnimationFrame(animateFunnel);
        const elapsedTime = clock.getElapsedTime();
        if (!isFunnelAnimating && particles) { 
            const posAttr = particles.geometry.attributes.position;
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const i3 = i * 3, x = posAttr.array[i3];
                const dY = noise.noise2D(x * 0.05, elapsedTime * 0.2) * 0.05;
                posAttr.array[i3 + 1] += dY;
            }
            posAttr.needsUpdate = true;
        }
        if (renderer && scene && camera) { renderer.render(scene, camera); }
    }

    function onWindowResize() {
        if (!camera || !renderer || !canvasWrapper) return;
        camera.aspect = canvasWrapper.clientWidth / canvasWrapper.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvasWrapper.clientWidth, canvasWrapper.clientHeight);
    }
    
    function initCustomVisualizations() {
        const dramaticSentence = document.querySelector('.dramatic-reveal-sentence');
        if (dramaticSentence) {
            const originalText = dramaticSentence.textContent;
            dramaticSentence.innerHTML = ''; 
            originalText.split('').forEach(char => {
                const span = document.createElement('span');
                span.className = 'char';
                span.innerHTML = char === ' ' ? ' ' : char;
                dramaticSentence.appendChild(span);
            });
            gsap.from(dramaticSentence.querySelectorAll('.char'), {
                scrollTrigger: { trigger: dramaticSentence, start: 'top 80%', toggleActions: 'play none none reverse' },
                duration: 0.6, ease: 'power1.out', y: 20, opacity: 0, stagger: 0.03,
                onStart: () => {
                    gsap.set(dramaticSentence.querySelectorAll('.char'), { visibility: 'visible' });
                }
            });
        }
        
        const competencyCards = gsap.utils.toArray('.competency-card');
        if (competencyCards.length) {
            gsap.from(competencyCards, {
                scrollTrigger: { trigger: '#cbta-vis-section', start: 'top 70%', toggleActions: 'play none none reverse' },
                opacity: 0, y: 50, duration: 0.5, stagger: 0.1, ease: 'power2.out'
            });
        }

        const timelineVis = document.getElementById('timeline-conflict-vis');
        if (timelineVis) {
            const getDayOfYear = date => (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 24 / 60 / 60 / 1000;
            const totalDays = 366;
            
            // REFINED: 将定位逻辑封装成一个更通用的函数
            const setElementPeriod = (selector, startDate, endDate) => {
                const startDay = getDayOfYear(new Date(startDate));
                const endDay = getDayOfYear(new Date(endDate));
                const element = timelineVis.querySelector(selector);
                if (element) {
                    element.style.left = `${(startDay / totalDays) * 100}%`;
                    element.style.width = `${((endDay - startDay) / totalDays) * 100}%`;
                }
            };
            
            // 使用新函数设置期限条
            setElementPeriod('.airline-period', '2024-03-01', '2024-09-01');
            setElementPeriod('.student-period', '2024-06-24', '2024-12-24');

            // REFINED: 使用新函数设置冲突区域高亮框 (6月24日 到 9月1日)
            setElementPeriod('.timeline-conflict-zone', '2024-06-24', '2024-09-01');
            
            // 设置事件点位置（这部分代码保持不变）
            timelineVis.querySelectorAll('.timeline-event').forEach(event => { 
                const eventDate = new Date(event.dataset.date); 
                if (!isNaN(eventDate)) { 
                    event.style.left = `${(getDayOfYear(eventDate) / totalDays) * 100}%`; 
                } 
            });
                gsap.from(timelineVis.querySelectorAll('.timeline-bar'), {
                scrollTrigger: { trigger: timelineVis, start: 'top 80%' },
                scaleX: 0,
                duration: 1,
                stagger: 0.2,
                ease: 'power2.out'
            });
            gsap.from(timelineVis.querySelectorAll('.timeline-event'), {
                scrollTrigger: { trigger: timelineVis, start: 'top 70%' },
                scaleY: 0,
                duration: 0.8,
                stagger: 0.2,
                ease: 'power2.out'
            });
        }
    }

    function initChartVisualizations() {
        // --- REFINED: Centralized Chart Style Variables ---
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-heading').trim();
        const textSecondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim();
        const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim();
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
        const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim();
        const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim();
        const successColor = getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim();
        const gridColor = 'rgba(255, 255, 255, 0.08)';
        const fontFamily = "'Noto Sans SC', sans-serif";

        // --- REFINED: Global Tooltip Configuration ---
        const defaultTooltipOptions = {
            enabled: true,
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            padding: 12,
            titleColor: textColor,
            bodyColor: textSecondaryColor,
            titleFont: { family: fontFamily, size: 14, weight: 'bold' },
            bodyFont: { family: fontFamily, size: 12 },
            displayColors: true,
            boxPadding: 4,
        };

        // Helper function for creating doughnut charts
        function createDoughnutChart(config) {
            const { canvasId, legendId, data, colors, tooltipTitle } = config;
            const canvas = document.getElementById(canvasId);
            const legendContainer = document.getElementById(legendId);
            if (!canvas || !legendContainer) return;
            
            legendContainer.innerHTML = '';
            data.labels.forEach((label, i) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="legend-color" style="background-color: ${colors[i]};"></div>
                    <div class="legend-text">
                        <strong>${label} (${data.datasets[0].data[i]}%)</strong>
                        <p>${data.descriptions[i]}</p>
                    </div>
                `;
                legendContainer.appendChild(li);
            });

            new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: data.labels,
                    datasets: [{
                        data: data.datasets[0].data,
                        backgroundColor: colors.map(color => `${color}E6`), // Add slight transparency
                        borderColor: surfaceColor,
                        borderWidth: 4,
                        hoverOffset: 12, // slightly smaller offset
                        hoverBorderWidth: 0,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1500,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            ...defaultTooltipOptions,
                            callbacks: {
                                title: () => tooltipTitle,
                                label: (context) => `  ${context.label}: ${context.parsed}%`,
                            }
                        },
                        datalabels: { display: false }
                    }
                }
            });
        }
        
        // --- REFINED: Grounding Reason Chart with Strategic Colors ---
        createDoughnutChart({
            canvasId: 'grounding-reason-chart',
            legendId: 'grounding-reason-legend',
            data: {
                labels: ['身体原因', '心理素质', '技术原因', '理论/挂科'],
                datasets: [{ data: [40, 25, 20, 15] }],
                descriptions: [
                    '年度体检中发现不符合标准，如视力下降、心脏问题等。',
                    '心理素质不达标，如焦虑症、抗压能力不足等。',
                    '实机飞行技术考核（如“十三筛”）不通过。',
                    '理论考试多次未通过，或多门课程挂科。'
                ]
            },
            colors: [primaryColor, secondaryColor, dangerColor, '#60a5fa'], // Strategic colors
            tooltipTitle: '常规停飞原因'
        });

        // --- REFINED: Low Altitude Chart with Strategic Colors ---
        createDoughnutChart({
            canvasId: 'low-altitude-chart',
            legendId: 'low-altitude-legend',
            data: {
                labels: ['商照培训', '私照培训', '航空喷洒', '石油服务', '其他'],
                datasets: [{ data: [46.4, 13.7, 5.7, 5.5, 28.7] }],
                descriptions: [
                    '培养专业飞行员以满足商业航空公司的需求。',
                    '为个人兴趣和非商业目的提供飞行培训。',
                    '用于农业、林业的播种、施肥、除虫等作业。',
                    '为海上石油平台提供人员和物资运输。',
                    '包括空中游览、护林、巡查、运动飞行等多种场景。'
                ]
            },
            colors: [secondaryColor, successColor, primaryColor, '#8b5cf6', textSecondaryColor], // Strategic colors
            tooltipTitle: '通用航空应用场景'
        });

        // --- REFINED: Industry Chart 1 (Line Chart) ---
        const industryChart1Canvas = document.getElementById('industry-chart-1');
        if (industryChart1Canvas) { 
            new Chart(industryChart1Canvas, { 
                type: 'line', 
                data: { 
                    labels: ['2013','2015','2017','2019','2020','2021','2022','2023'], 
                    datasets: [
                        { 
                            label: '营业收入(亿元)', 
                            data: [5889,6062,7460,10624,6246,7529,6328,10237], 
                            borderColor: primaryColor, 
                            backgroundColor: `${primaryColor}30`, // More transparent fill for gradient
                            fill: false, // REFINED: Removed fill for clarity
                            tension: 0.4,
                            borderWidth: 2.5,
                            pointRadius: 0, // REFINED: Hide points, show on hover
                            pointHoverRadius: 6,
                            yAxisID: 'y' 
                        }, 
                        { 
                            label: '飞行员数量(人)', 
                            data: [35505,45523,55765,67953,69442,76236,81430,86091], 
                            borderColor: textSecondaryColor, // REFINED: Muted color for secondary axis
                            backgroundColor: `${textSecondaryColor}20`,
                            fill: false, // REFINED: Removed fill for clarity
                            tension: 0.4,
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            borderDash: [5, 5], // REFINED: Dashed line for secondary data
                            yAxisID: 'y1' 
                        }
                    ] 
                }, 
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { 
                        legend: { 
                            position: 'top', align: 'end',
                            labels: { color: textColor, padding: 20, font: { family: fontFamily, size: 12 } }
                        },
                        tooltip: {
                             ...defaultTooltipOptions,
                             callbacks: {
                                label: (context) => `  ${context.dataset.label || ''}: ${context.parsed.y.toLocaleString()}`
                             }
                        },
                        datalabels: { display: false } // REFINED: Globally hide data labels
                    }, 
                    scales: { 
                        y: { 
                            ticks: { color: textSecondaryColor, font: { family: fontFamily, size: 11 } }, 
                            grid: { color: gridColor, drawBorder: false },
                            border: { display: false }
                        }, 
                        y1: { 
                            type: 'linear', display: true, position: 'right', 
                            grid: { drawOnChartArea: false },
                            ticks: { color: textSecondaryColor, font: { family: fontFamily, size: 11 } },
                            border: { display: false }
                        }, 
                        x: { 
                            ticks: { color: textSecondaryColor, font: { family: fontFamily, size: 11 } }, 
                            grid: { display: false },
                            border: { display: false }
                        } 
                    }
                } 
            }); 
        }
        
        // --- REFINED: Industry Chart 2 (Combo Chart) ---
        const industryChart2Canvas = document.getElementById('industry-chart-2');
        if (industryChart2Canvas) { 
            const ctx = industryChart2Canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 350);
            gradient.addColorStop(0, `${primaryColor}60`);
            gradient.addColorStop(1, `${primaryColor}00`);

            new Chart(industryChart2Canvas, { 
                data: { 
                    labels: ['2013','2015','2017','2019','2020','2021','2022','2023'], 
                    datasets: [
                        { type: 'bar', label: '招收学生(人)', data: [18261,20509,21636,23610,23221,22484,23389,22685], backgroundColor: 'rgba(239, 68, 68, 0.6)', yAxisID: 'y' }, 
                        { type: 'line', label: '旅客运输量(万人)', data: [35397,43618,55156,65993,41777,44055,25171,61957], 
                          borderColor: primaryColor, // REFINED: Use primary color for main trend
                          backgroundColor: gradient, // REFINED: Use gradient fill
                          tension: 0.4, 
                          fill: true,
                          borderWidth: 2.5,
                          pointRadius: 0,
                          pointHoverRadius: 6,
                          yAxisID: 'y1' 
                        }
                    ] 
                }, 
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    interaction: { mode: 'index', intersect: false },
                    plugins: { 
                        legend: { position: 'top', align: 'end', labels: { color: textColor, padding: 20, font: { family: fontFamily, size: 12 } } },
                        tooltip: { ...defaultTooltipOptions },
                        datalabels: { display: false } // REFINED: Globally hide data labels
                    }, 
                    scales: { 
                        y: { 
                            ticks: { color: textSecondaryColor, font: { family: fontFamily, size: 11 } }, 
                            grid: { color: gridColor, drawBorder: false },
                            border: { display: false }
                        }, 
                        y1: { 
                            type: 'linear', display: true, position: 'right', 
                            grid: { drawOnChartArea: false }, 
                            ticks: { color: textSecondaryColor, font: { family: fontFamily, size: 11 } },
                            border: { display: false }
                        }, 
                        x: { 
                            ticks: { color: textSecondaryColor, font: { family: fontFamily, size: 11 } }, 
                            grid: { display: false },
                            border: { display: false }
                        }
                    } 
                } 
            }); 
        }

        // --- REFINED: Profit & Loss Chart ---
        const profitLossCtx = document.getElementById('profit-loss-chart');
        if (profitLossCtx) {
            new Chart(profitLossCtx, {
                type: 'bar',
                data: {
                    labels: ['2019', '2020', '2021', '2022', '2023'],
                    datasets: [{
                        label: '利润总额 (亿元)', 
                        data: [541.3, -974.32, -842.5, -2174.4, 210.7],
                        backgroundColor: (context) => context.raw >= 0 ? successColor : dangerColor,
                        borderRadius: 4, // REFINED: Add border radius
                        borderWidth: 0,
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            ...defaultTooltipOptions,
                            callbacks: { 
                                label: (context) => `  ${context.dataset.label || ''}: ${context.parsed.y.toFixed(1)} 亿元`
                            }
                        },
                        // REFINED: Polished data labels
                        datalabels: {
                            color: textColor,
                            font: { weight: '500', family: fontFamily, size: 12 },
                            anchor: (context) => (context.dataset.data[context.dataIndex] >= 0 ? 'end' : 'start'),
                            align: (context) => (context.dataset.data[context.dataIndex] >= 0 ? 'top' : 'bottom'),
                            offset: 6,
                            formatter: (value) => value.toLocaleString(),
                            // Add a subtle stroke for better readability on any background
                            textStrokeColor: 'rgba(10, 10, 16, 0.8)',
                            textStrokeWidth: 4,
                        }
                    },
                    scales: {
                        y: { 
                            ticks: { 
                                color: textSecondaryColor,
                                font: { family: fontFamily, size: 11 },
                                callback: (value) => value.toLocaleString() // REFINED: Cleaner axis labels
                            }, 
                            grid: { color: gridColor, drawBorder: false } ,
                            border: { display: false }
                        },
                        x: { 
                            ticks: { color: textSecondaryColor, font: { family: fontFamily, size: 11 } }, 
                            grid: { display: false },
                            border: { display: false }
                        }
                    }
                }
            });
        }
    }
    
    function initPathwayVisualization() {
        const container = document.getElementById('pathway-vis-container');
        if (!container) return;
        const textDiv = document.getElementById('pathway-text'), stickyWrapper = container.querySelector(".pathway-sticky-wrapper"); 
        const storyContent = [
            { text: "对于停飞有争议的学员来说，最好的解决方式是向航空公司证明自己被停飞的冤枉。被停飞之后，云生跟其他养成生及家长一起组织过多次的维权行动，从跟航司谈判到向国家信访局递交联名信，来来回回已有超过十次。2024年12月，云生和许多飞行养成生一起去民航局讨要一个“说法”，民航局给出的回应是，学员的要求符合实情，民航局会督促东航尽快解决问题。但是当2025年云生等人第二次与民航局交涉时，其态度发生了巨大转变，给出的回应是“东航的上属单位是国资委，而并非民航局直接管辖，民航局只能对东航提出建议。", imgId: "#pathway-img-1" },
            { text: "另一方面，被停飞的学员也能选择转向其他的专业。在中飞院提供的转专业方案中，被停飞学员可以根据专业成绩选择包括航空物流、航空管理、地面服务专业在内的地面专业进行学习，从而继续留在民航业内。但是对于被停飞学员来说，时间是这条路上最大的阻碍，选择转地面专业意味着再次从大一开始学习years，这对于已经因为疫情耽误两年的学员来说成本太大。", imgId: "#pathway-img-2" },
            { text: "“转专业之后还要重新学内容，不仅以前的内容都白学了，我学完毕业也都快三十了，况且待遇差别也巨大。”云生说，“你是冲着飞行员来的，现在去干别的了，换作谁都很难接受吧。”", imgId: "#pathway-img-3" }
        ];
        const allFrames = gsap.utils.toArray('.pathway-frame');
        gsap.set(allFrames, { autoAlpha: 0 });
        gsap.set(storyContent[0].imgId, { autoAlpha: 1 });
        if (textDiv) textDiv.innerHTML = storyContent[0].text;
        gsap.set(stickyWrapper, { autoAlpha: 1 }); 
        const tl = gsap.timeline();
        tl.to({}, { duration: 1 });
        storyContent.forEach((content, index) => {
            if (index === 0) return; 
            tl.call(() => { if (textDiv) textDiv.innerHTML = content.text; })
            .to(storyContent[index - 1].imgId, { autoAlpha: 0, duration: 0.5 }, '<')
            .to(content.imgId, { autoAlpha: 1, duration: 0.5 }, '<')
            .to({}, { duration: 1 }); 
        });
        tl.to(stickyWrapper, { autoAlpha: 0, duration: 0.5 });
        ScrollTrigger.create({ trigger: container, start: "top top", end: "bottom bottom", pin: true, scrub: 1, animation: tl, anticipatePin: 1 });
    }

    function initPressureCloudAnimation() {
        const cloudItems = document.querySelectorAll('.pressure-cloud span');
        if (!cloudItems.length) return;
        cloudItems.forEach(item => {
            const top = 10 + Math.random() * 50, left = 15 + Math.random() * 70;
            const duration = 20 + Math.random() * 10, delay = -Math.random() * 8;
            const weight = parseFloat(item.dataset.weight);
            const scale = 0.9 + (weight - 0.5) * 1.8, opacity = 0.5 + (weight - 0.5) * 0.4;
            item.style.top = `${top}%`;
            item.style.left = `${left}%`;
            item.style.animationDuration = `${duration}s`;
            item.style.animationDelay = `${delay}s`;
            item.style.setProperty('--scale', scale);
            item.style.opacity = opacity;
        });
    }

    function initBarrageQuotes() {
        const container = document.querySelector('.barrage-container');
        if (!container) return;
        const quotes = [ "每天晚上三四点就会被噩梦吓醒，总觉得自己要被停飞了", "自从下了分院之后也没有开心过，每天都是在紧张焦虑中度过", "睡觉睡不好，脑子控制不佳胡思乱想，记忆力也变得好差", "经常怀疑自己得了病，害怕四年时间就这么浪费", "我很羡慕新入学的学生，他们至少不用经历疫情和现在的停飞政策" ];
        ScrollTrigger.create({
            trigger: "#barrage-quote-section", start: "top 80%", end: "bottom 20%",
            onEnter: () => {
                if (container.children.length === 0) {
                    quotes.forEach(quoteText => {
                        const quoteEl = document.createElement('span');
                        quoteEl.className = 'barrage-quote';
                        quoteEl.innerText = quoteText;
                        const duration = 15 + Math.random() * 10, top = 5 + Math.random() * 85, delay = Math.random() * 10;
                        quoteEl.style.top = `${top}%`;
                        quoteEl.style.animationDuration = `${duration}s`;
                        quoteEl.style.animationDelay = `-${delay}s`;
                        container.appendChild(quoteEl);
                    });
                }
            }
        });
    }

    function initGeneralScrollAnimations() {
        gsap.utils.toArray(".text-section, .vis-section").forEach(elem => {
            if (elem.matches('#funnel-animation-container, #pathway-vis-container, .pathway-question, #epilogue, #grounding-reason-vis, #low-altitude-vis, #cbta-vis-section, .dramatic-reveal-sentence')) {
                return;
            }
            gsap.from(elem, { 
                scrollTrigger: { trigger: elem, start: "top 90%", end: "bottom 10%", toggleActions: "play none none reverse" }, 
                opacity: 0, y: 50, duration: 1, ease: "power2.out"
            });
        });
    }
    
    function initChinaMap() {
        const chartDom = document.getElementById('china-map');
        if (!chartDom || typeof echarts === 'undefined') return;
        const myChart = echarts.init(chartDom, 'dark');
        const regionalData = { '华北': 3000, '东北': 2399, '华东': 5397, '中南': 4218, '西南': 2983, '西北': 1561, '新疆': 421 };
        const provinceToRegion = { '北京': '华北', '天津': '华北', '河北': '华北', '山西': '华北', '内蒙古': '华北', '辽宁': '东北', '吉林': '东北', '黑龙江': '东北', '上海': '华东', '江苏': '华东', '浙江': '华东', '安徽': '华东', '福建': '华东', '江西': '华东', '山东': '华东', '河南': '中南', '湖北': '中南', '湖南': '中南', '广东': '中南', '广西': '中南', '海南': '中南', '重庆': '西南', '四川': '西南', '贵州': '西南', '云南': '西南', '西藏': '西南', '陕西': '西北', '甘肃': '西北', '青海': '西北', '宁夏': '西北', '新疆': '新疆', '香港': '中南', '澳门': '中南', '台湾': '华东' };
        
        Promise.all([ fetch('js/china.json').then(res => res.json()), fetch('js/southchinasea.json').then(res => res.json()) ])
        .then(([chinaJson, southChinaSeaJson]) => {
            echarts.registerMap('china', chinaJson);
            echarts.registerMap('southchinasea', southChinaSeaJson);
            const mapData = chinaJson.features.map(feature => {
                const provinceName = feature.properties.name.replace(/省|市|自治区|特别行政区|inant/g, '');
                return { name: feature.properties.name, value: regionalData[provinceToRegion[provinceName]] || 0, region: provinceToRegion[provinceName] };
            });
            const option = { 
                backgroundColor: 'transparent', 
                tooltip: { 
                    trigger: 'item', 
                    formatter: p => p.seriesName === '南海诸岛' ? '' : (p.data ? `${p.data.region} - ${p.name}<br/>区域单位数: <strong>${p.data.value.toLocaleString()}</strong>` : `${p.name}<br/>无数据`), 
                    backgroundColor: 'rgba(17, 24, 39, 0.9)', 
                    borderColor: 'var(--color-primary)', 
                    borderWidth: 1, 
                    textStyle: { color: 'var(--color-text)', fontFamily: "'Noto Sans SC', sans-serif" } 
                }, 
                visualMap: { 
                    min: 400, max: 6000, 
                    left: '5%', bottom: '5%', 
                    text: ['高', '低'], 
                    calculable: true, 
                    inRange: { color: ['#3A5FCD', '#3b82f6', '#f59e0b', '#FF4500'] },
                    textStyle: { color: 'var(--color-text-secondary)' } 
                }, 
                series: [
                    { 
                        name: '无人机运营单位', type: 'map', map: 'china', roam: false,
                        emphasis: {
                            label: { show: false },
                            itemStyle: {
                                areaColor: 'var(--color-primary)',
                                shadowBlur: 10,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        },
                        data: mapData 
                    },
                    { 
                        name: '南海诸岛', type: 'map', map: 'southchinasea', 
                        right: '5%', bottom: '5%', width: '15%', 
                        itemStyle: { areaColor: '#2c3e50', borderColor: '#8897b3' },
                        emphasis: { disabled: true }
                    }
                ] 
            };
            myChart.setOption(option);
            window.addEventListener('resize', () => myChart.resize());
        }).catch(e => { 
            console.error("Map data loading failed:", e); 
            chartDom.innerHTML = "<p style='color:red; text-align:center;'>地图数据加载失败，请确保 js/china.json 和 js/southchinasea.json 文件存在。</p>"; 
        });
    }
    
    function initRiskDiagramAnimation() {
        const riskDiagram = document.querySelector('.risk-diagram');
        if (!riskDiagram) return;
        const center = riskDiagram.querySelector('.risk-center'), items = riskDiagram.querySelectorAll('.risk-item');
        const tl = gsap.timeline({ scrollTrigger: { trigger: riskDiagram, start: "top 75%", toggleActions: "play none none reverse", } });
        tl.from(center, { scale: 0, opacity: 0, duration: 0.8, ease: "back.out(1.7)" });
        items.forEach((item) => tl.from(item, { scale: 0.2, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.5"));
    }


    function initEpilogueAnimation() {
        const epilogueSection = document.getElementById('epilogue');
        const finalWord = document.querySelector('.final-word');
        
        if (!epilogueSection || !finalWord) return;

        // --- REFINED: 使用一个主时间线来编排所有结尾动画 ---
        const masterTimeline = gsap.timeline({
            scrollTrigger: {
                trigger: epilogueSection, // 整个结尾部分作为主触发器
                start: "top 10%",         
                end: "top top",     
                scrub: 1.5,               // 平滑地与滚动条绑定
            }
        });

        // 动画1: “滚动揭幕”效果 - 让整个结尾区域从黑暗中浮现
        // 这完全还原了你最初的动画效果
        masterTimeline.to(epilogueSection, {
            opacity: 1,       // 目标：完全不透明
            duration: 5,        // 在时间线中，duration代表“占据”的时长比例
            ease: "none"
        }, 0); // "0" 表示这个动画从时间线的一开始就执行

        // 动画2: “固定并渐隐”效果 - 针对最后的句子
        // 我们将这个动画也放入同一个时间线中
        const pinTimeline = gsap.timeline({
            scrollTrigger: {
                trigger: finalWord,     // 这个动画的触发器是 finalWord 本身
                start: "center center", // 当它到达屏幕中央时开始
                end: "+=90vh",          // 持续 50vh 的滚动距离
                scrub: 1,
            }
        });

        // 在这个被固定的时间段内，让文字渐隐
        pinTimeline.to(finalWord, {
            autoAlpha: 0, // 渐隐消失
            ease: "power1.in",
        });
    }

    function createObserver(selector, visibleClass, options) {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) return;

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add(visibleClass);
                    obs.unobserve(entry.target);
                }
            });
        }, options);

        elements.forEach(el => observer.observe(el));
    }

    createObserver('.cinematic-lead', 'is-visible', {
        threshold: 1.0,
        rootMargin: "-20% 0px -20% 0px"
    });

    createObserver('.testimonial-card', 'is-visible', {
        threshold: 0.4, 
    });
    
    // --- Initialize all functions ---
    initHeroAnimation();
    initFunnelVisualization();
    initCustomVisualizations();
    initChartVisualizations();
    initPathwayVisualization();
    initPressureCloudAnimation();
    initBarrageQuotes();
    initChinaMap();                 
    initGeneralScrollAnimations();
    initSideDecorations();
    initRiskDiagramAnimation();
    initEpilogueAnimation();
    initChapterNav(); 

});