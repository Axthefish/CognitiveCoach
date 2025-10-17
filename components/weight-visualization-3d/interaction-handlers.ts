/**
 * 交互处理器
 * 
 * 功能：
 * - Raycaster射线检测
 * - 鼠标事件处理
 * - 节点hover/click检测
 */

import * as THREE from 'three';

/**
 * 交互事件类型
 */
export type InteractionEventType = 'hover' | 'click' | 'unhover';

/**
 * 交互事件数据
 */
export interface InteractionEvent {
  type: InteractionEventType;
  nodeId: string | null;
  object: THREE.Object3D | null;
  point: THREE.Vector3 | null;
}

/**
 * 交互处理器类
 */
export class InteractionHandler {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredObject: THREE.Object3D | null = null;
  
  constructor(
    private camera: THREE.Camera,
    private scene: THREE.Scene
  ) {}
  
  /**
   * 处理鼠标移动
   */
  onMouseMove(event: MouseEvent, container: HTMLElement): InteractionEvent | null {
    this.updateMousePosition(event, container);
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // 过滤出有nodeId的对象（忽略其他元素如网格、光源等）
    const validIntersects = intersects.filter(
      intersect => intersect.object.userData.nodeId
    );
    
    if (validIntersects.length > 0) {
      const object = validIntersects[0].object;
      const nodeId = object.userData.nodeId;
      
      // 如果是新的对象，触发hover事件
      if (this.hoveredObject !== object) {
        // 先触发unhover（如果有之前的对象）
        if (this.hoveredObject) {
          const prevNodeId = this.hoveredObject.userData.nodeId;
          this.hoveredObject = null;
          return {
            type: 'unhover',
            nodeId: prevNodeId,
            object: null,
            point: null,
          };
        }
        
        // 触发hover
        this.hoveredObject = object;
        return {
          type: 'hover',
          nodeId,
          object,
          point: validIntersects[0].point,
        };
      }
    } else {
      // 没有悬停对象，触发unhover
      if (this.hoveredObject) {
        const prevNodeId = this.hoveredObject.userData.nodeId;
        this.hoveredObject = null;
        return {
          type: 'unhover',
          nodeId: prevNodeId,
          object: null,
          point: null,
        };
      }
    }
    
    return null;
  }
  
  /**
   * 处理鼠标点击
   */
  onClick(event: MouseEvent, container: HTMLElement): InteractionEvent | null {
    this.updateMousePosition(event, container);
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // 过滤出有nodeId的对象
    const validIntersects = intersects.filter(
      intersect => intersect.object.userData.nodeId
    );
    
    if (validIntersects.length > 0) {
      const object = validIntersects[0].object;
      const nodeId = object.userData.nodeId;
      
      return {
        type: 'click',
        nodeId,
        object,
        point: validIntersects[0].point,
      };
    }
    
    return null;
  }
  
  /**
   * 更新鼠标位置（归一化坐标）
   */
  private updateMousePosition(event: MouseEvent, container: HTMLElement) {
    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
  
  /**
   * 重置状态
   */
  reset() {
    this.hoveredObject = null;
  }
  
  /**
   * 获取当前悬停的节点ID
   */
  getHoveredNodeId(): string | null {
    return this.hoveredObject?.userData.nodeId || null;
  }
}

