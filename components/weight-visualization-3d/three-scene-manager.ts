/**
 * Three.js场景管理器
 * 
 * 功能：
 * - 场景初始化
 * - 光照配置
 * - 相机管理
 * - 渲染器配置
 * - 响应式处理
 */

import * as THREE from 'three';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  
  constructor(container: HTMLElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 15, 40);
    
    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(8, 8, 8);
    this.camera.lookAt(0, 0, 0);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    
    // Lights
    this.setupLights();
  }
  
  /**
   * 设置光照
   */
  private setupLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    // 主方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    this.scene.add(directionalLight);
    
    // 补光1（蓝色）
    const pointLight1 = new THREE.PointLight(0x3b82f6, 0.5, 50);
    pointLight1.position.set(-10, -10, -5);
    this.scene.add(pointLight1);
    
    // 补光2（紫色）
    const pointLight2 = new THREE.PointLight(0x60a5fa, 0.3, 50);
    pointLight2.position.set(10, -10, 5);
    this.scene.add(pointLight2);
  }
  
  /**
   * 响应窗口大小变化
   */
  onWindowResize(container: HTMLElement) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  /**
   * 渲染一帧
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * 清理资源
   */
  dispose() {
    this.renderer.dispose();
    this.scene.clear();
  }
}

