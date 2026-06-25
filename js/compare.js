const { app } = window.comfyAPI.app;

app.registerExtension({
    name: "NineImageCompareExtension",
    nodeCreated(node) {
        if (node.comfyClass === "NineImageCompare") {
            // 创建容器
            const container = document.createElement("div");
            container.className = "nine-compare-container";
            container.style.cssText = `
                position: relative;
                width: 100%;
                height: 600px;
                overflow: hidden;
                cursor: crosshair;
                background: #222;
                display: grid;
                gap: 4px;
                padding: 4px;
                box-sizing: border-box;
            `;
            
            // 初始化全局滑动位置状态 (0 到 1 之间)
            node.sliderPositionX = 0.5;
            node.sliderPositionY = 0.5;
            node.isDragging = false;
            node.dragDirection = null; // 'horizontal' 或 'vertical'
            node.startX = 0;
            node.startY = 0;
            node.activeGroup = null; // 记录当前交互的宫格

            // 同步更新所有滑动条和裁剪区域的方法
            const updateAllSliders = () => {
                const groups = container.querySelectorAll('.compare-group');
                const vLines = container.querySelectorAll('.slider-line-v');
                const hLines = container.querySelectorAll('.slider-line-h');
                const pX = node.sliderPositionX * 100;
                const pY = node.sliderPositionY * 100;
                
                groups.forEach(g => {
                    const overlay = g.querySelector('.compare-overlay');
                    const vLine = g.querySelector('.slider-line-v');
                    const hLine = g.querySelector('.slider-line-h');
                    if (overlay) {
                        if (node.dragDirection === 'horizontal') {
                            // 左右对比：左侧参考图，右侧对比图
                            overlay.style.clipPath = `inset(0 0 0 ${pX}%)`;
                            if (vLine) vLine.style.display = 'block';
                            if (hLine) hLine.style.display = 'none';
                        } else if (node.dragDirection === 'vertical') {
                            // 上下对比：上侧参考图，下侧对比图
                            overlay.style.clipPath = `inset(0 0 ${100 - pY}% 0)`;
                            if (vLine) vLine.style.display = 'none';
                            if (hLine) hLine.style.display = 'block';
                        }
                    }
                });
                
                if (node.dragDirection === 'horizontal') {
                    vLines.forEach(l => l.style.left = `${pX}%`);
                } else if (node.dragDirection === 'vertical') {
                    hLines.forEach(l => l.style.top = `${pY}%`);
                }
            };

            // 绑定全局鼠标事件（确保只绑定一次）
            const onMouseMove = (moveEvent) => {
                if (!node.isDragging || !node.activeGroup) return;

                const dx = moveEvent.clientX - node.startX;
                const dy = moveEvent.clientY - node.startY;

                // 首次移动超过3px时锁定方向
                if (!node.dragDirection) {
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        node.dragDirection = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
                    }
                }

                if (node.dragDirection) {
                    const currentRect = node.activeGroup.getBoundingClientRect();
                    if (node.dragDirection === 'horizontal') {
                        node.sliderPositionX = Math.max(0, Math.min(1, (moveEvent.clientX - currentRect.left) / currentRect.width));
                    } else {
                        node.sliderPositionY = Math.max(0, Math.min(1, (moveEvent.clientY - currentRect.top) / currentRect.height));
                    }
                    updateAllSliders();
                }
            };


            const onMouseUp = () => {
                node.isDragging = false;
                node.activeGroup = null;
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);

            
            node.addDOMWidget("nine-compare", "preview", container, {
                serialize: false,
                hideOnZoom: false
            });

            // 监听节点执行完成事件
            node.onExecuted = (message) => {
                container.innerHTML = ''; // 清空旧内容
                const refImageData = message?.ref_image?.[0];
                const compareImagesData = message?.compare_images || [];

                if (!refImageData) return;

                // 计算有效对比图数量，限制在1到9之间
                const validCompares = compareImagesData.filter(d => d && d.length > 0);
                const count = Math.max(1, Math.min(9, validCompares.length));
                
                // 动态计算行列数
                const cols = Math.ceil(Math.sqrt(count));
                const rows = Math.ceil(count / cols);
                container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

                // 为参考图和对比图创建对比组
                compareImagesData.forEach((compImageData, index) => {
                    if (!compImageData || compImageData.length === 0) return;

                    const group = document.createElement("div");
                    group.className = "compare-group";
                    group.style.cssText = `
                        position: relative;
                        flex: 1;
                        overflow: hidden;
                        border: 1px solid #444;
                        border-radius: 4px;
                    `;

                    const refImg = document.createElement("img");
                    refImg.src = `/view?filename=${refImageData.filename}&subfolder=${refImageData.subfolder}&type=${refImageData.type}`;
                    refImg.style.cssText = `
                        position: absolute; top: 0; left: 0;
                        width: 100%; height: 100%; object-fit: contain;
                        z-index: 1;
                    `;

                    const compImg = document.createElement("img");
                    compImg.src = `/view?filename=${compImageData[0].filename}&subfolder=${compImageData[0].subfolder}&type=${compImageData[0].type}`;
                    compImg.className = "compare-overlay";
                    compImg.style.cssText = `
                        position: absolute; top: 0; left: 0;
                        width: 100%; height: 100%; object-fit: contain;
                        z-index: 2;
                        clip-path: inset(0 0 0 0);
                    `;

                    // 竖向滑动指示线 (左右对比时使用)
                    const sliderLineV = document.createElement("div");
                    sliderLineV.className = "slider-line-v";
                    sliderLineV.style.cssText = `
                        position: absolute; top: 0; bottom: 0;
                        left: 50%; width: 2px;
                        border-left: 2px dashed #fff;
                        background: none;
                        opacity: 0.8;
                        pointer-events: none; z-index: 10;
                        display: none;
                    `;

                    // 横向滑动指示线 (上下对比时使用)
                    const sliderLineH = document.createElement("div");
                    sliderLineH.className = "slider-line-h";
                    sliderLineH.style.cssText = `
                        position: absolute; left: 0; right: 0;
                        top: 50%; height: 2px;
                        border-top: 2px dashed #fff;
                        background: none;
                        opacity: 0.8;
                        pointer-events: none; z-index: 10;
                        display: none;
                    `;

                    group.appendChild(refImg);
                    group.appendChild(compImg);
                    group.appendChild(sliderLineV);
                    group.appendChild(sliderLineH);
                    container.appendChild(group);

                    // 鼠标按下时记录初始状态
                    group.addEventListener("mousedown", (e) => {
                        e.preventDefault();
                        node.isDragging = true;
                        node.dragDirection = null; // 重置方向
                        node.startX = e.clientX;
                        node.startY = e.clientY;
                        node.activeGroup = group; // 记录当前宫格
                        
                        const rect = group.getBoundingClientRect();
                        node.sliderPositionX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        node.sliderPositionY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                    });

                });
            };
        }
    }
});
