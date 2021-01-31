import { createTaskQueue, arrified, createStateNode, getTag } from "../Misc"

/**
 * 任务队列
 */
const taskQueue = createTaskQueue()
/**
 * 要执行的子任务
 */
let subTask = null

let pendingCommit = null

const commitAllWork = fiber =>{
  fiber.effects.forEach(item => {
    if (item.effectTag === "placement") {
      item.parent.stateNode.appendChild(item.stateNode)
    }
  })
}

const getFirstTask = () => {
  /**
   * 从任务队列中获取任务
   */ 
  const task = taskQueue.pop()
  /**
   * 返回最外层节点的fiber对象
   */
  return {
    props: task.props,
    stateNode: task.dom,
    tag: "host_root",
    effects: [],
    child: null
  }
}

const reconcileChildren =(fiber, children) => {
  /**
   * children 可能是对象 也有可能是数组
   * 将children 转换成数组
   */
  const arrifiedChildren = arrified(children)
  let index = 0
  let numberOfElements = arrifiedChildren.length
  let element = null
  let newFiber = null
  let prevFiber = null

  while (index < numberOfElements) {
    /**
     * 子级 virtualDOM 对象
     */
    element = arrifiedChildren[index]
    /**
     * 子级 fiber 对象
     */
    newFiber = {
      type: element.type,
      props: element.props,
      tag: getTag(element),
      effects: [],
      effectTag: "placement",
      // stateNode: null,
      parent: fiber
    }

    newFiber.stateNode = createStateNode(newFiber)

    // 为父级 fiber 添加子级 fiber
     if(index == 0) {
      fiber.child = newFiber
     } else {
       // 为fiber添加下一个兄弟fiber
       prevFiber.sibling = newFiber
     }

     prevFiber = newFiber

    index++
  }
}
/**
 * 构建子级fiber对象
 */
const executeTask = fiber => {
  reconcileChildren(fiber, fiber.props.children)
  /**
   * 如果子级存在 返回子级
   * 将这个子级当做父级 构建这个父级下的子级
   */
  if (fiber.child) {
    return fiber.child
  }
  /**
   * 如果同级存在 返回同级 构建同级的子级
   * 如果同级不存在 返回到父级 看父级是否有同级
   */
  let currentExecutelyFiber = fiber

  while (currentExecutelyFiber.parent) {
    currentExecutelyFiber.parent.effects = currentExecutelyFiber.parent.effects.concat(
      currentExecutelyFiber.effects.concat([currentExecutelyFiber])
    )
    
    if(currentExecutelyFiber.sibling)
    {
      return currentExecutelyFiber.sibling
    }
    currentExecutelyFiber = currentExecutelyFiber.parent
   
  }
  pendingCommit = currentExecutelyFiber
  // console.log(fiber)
}

const workLoop = deadline =>{
  /**
   * 如果子任务不存在 就去获取子任务
   */
  if (!subTask) {
    subTask = getFirstTask()
    // console.log(subTask)
  }
  /**
   * 如果任务存在并且浏览器有空余时间就调用
   * executeTask 方法执行任务 接受任务并返回新的任务
   */
  while (subTask && deadline.timeRemaining() > 1) {
    subTask = executeTask(subTask)
  }

  if (pendingCommit)
  {
    commitAllWork(pendingCommit)
  }
}

const performTask = deadline => {
  /**
   * 判断任务是否存在
   * 判断任务队列中是否还有任务没有执行
   * 再一次告诉浏览器在空闲的时间执行任务
   */
  workLoop(deadline)
  if (subTask || !taskQueue.isEmpty()) {
    requestIdleCallback(performTask)
  }
}

export const render = (element, dom) => {
    // console.log(element)
    // console.log(dom)
  /**
   * 1. 向任务队列中添加任务
   * 2. 指定在浏览器空闲时执行任务
   */
  /**
   * 任务就是通过 vdom 对象 构建 fiber 对象
   * 
   */
  taskQueue.push({
    dom,
    props: { children: element }
  })
  /**
   * 指定在浏览器空闲的时间去执行任务 
   */
  requestIdleCallback(performTask)
}
