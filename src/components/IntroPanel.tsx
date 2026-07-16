import { Github, Layers, Box, MousePointer2 } from 'lucide-react';

export function IntroPanel() {
  return (
    <div className="intro-panel">
      <section className="intro-section">
        <h2 className="intro-title">
          <Box className="h-5 w-5 text-amber-400" />
          项目介绍
        </h2>
        <p className="intro-text">
          这是一个伪 3D 的 2D 渲染器实验项目。大地图由多张相同大小的小贴图拼接而成，
          摄像机通过斜二侧法将世界坐标投影到屏幕。支持两种摄像机视角、虚拟摇杆、
          滑动旋转、墙面 BSP 遮挡以及可复用的 world 结构系统。
        </p>
      </section>

      <section className="intro-section">
        <h2 className="intro-title">
          <MousePointer2 className="h-5 w-5 text-amber-400" />
          World 编辑器说明
        </h2>
        <ul className="intro-list">
          <li>上方预览区可自由拖动中间分隔线调整上下区域大小。</li>
          <li>在预览区左右滑动可旋转 θ；θ 会自动保持在 0°~360° 之间。</li>
          <li>“最大灵敏度”滑块可调整滑动旋转的速度倍数。</li>
          <li>“摄像机调试”区可精确定位摄像机、切换视角、缩放。</li>
          <li>“world 文件编辑”区可直接编辑 world.txt，支持下载与上传。</li>
          <li>所有贴图必须从 /material/ 材质包中调用，world.txt 中只需写文件名。</li>
        </ul>
      </section>

      <section className="intro-section">
        <h2 className="intro-title">
          <Layers className="h-5 w-5 text-amber-400" />
          world.txt 格式速查
        </h2>
        <pre className="intro-code">
{`# 普通精灵
(x1,y1,z1) (x2,y2,z2) image.png

# 结构定义
structure name:(
  (x1,y1,z1) (x2,y2,z2) image-1.png
  (x3,y3,z3) (x4,y4,z4) image-2.png
)

# 结构调用（可带偏移）
stu name (x,y,z)`}
        </pre>
      </section>

      <a
        href="https://github.com/QangXing/July-24th"
        target="_blank"
        rel="noreferrer"
        className="intro-github"
      >
        <Github className="h-5 w-5" />
        GitHub: QangXing/July-24th
      </a>
    </div>
  );
}
