import { useEffect, useRef, useState } from 'react';
import { useRendererStore } from '@/store/rendererStore';
import { getAllMaterials, addMaterial, deleteMaterial } from '@/core/materialDB';
import { Upload, Trash2, ImageIcon } from 'lucide-react';

const BUILTIN_MATERIALS = [
  'platform.png',
  'wall-brown.png',
  'wall-blue.png',
  'grass.png',
  'Image_1780840100254_599.jpg',
];

export function MaterialManager() {
  const materials = useRendererStore((state) => state.materials);
  const setMaterials = useRendererStore((state) => state.setMaterials);
  const addMaterialToStore = useRendererStore((state) => state.addMaterial);
  const removeMaterialFromStore = useRendererStore((state) => state.removeMaterial);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载内置材质与 IndexedDB 上传的材质
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    (async () => {
      const next: Record<string, string> = {};

      for (const name of BUILTIN_MATERIALS) {
        next[name] = `/material/${name}`;
      }

      try {
        const stored = await getAllMaterials();
        for (const { name, blob } of stored) {
          const url = URL.createObjectURL(blob);
          next[name] = url;
          urls.push(url);
        }
      } catch (err) {
        console.warn('[MaterialManager] 读取已上传材质失败:', err);
      }

      if (!cancelled) {
        setMaterials(next);
      }
    })();

    return () => {
      cancelled = true;
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [setMaterials]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const name = file.name.toLowerCase();
      if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(name)) {
        console.warn(`[MaterialManager] 跳过不支持的文件: ${name}`);
        continue;
      }

      try {
        await addMaterial(name, file);
        const url = URL.createObjectURL(file);
        addMaterialToStore(name, url);
      } catch (err) {
        console.warn(`[MaterialManager] 上传 ${name} 失败:`, err);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (name: string) => {
    if (BUILTIN_MATERIALS.includes(name)) {
      console.warn('[MaterialManager] 不能删除内置材质:', name);
      return;
    }
    try {
      const url = materials[name];
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
      await deleteMaterial(name);
      removeMaterialFromStore(name);
    } catch (err) {
      console.warn(`[MaterialManager] 删除 ${name} 失败:`, err);
    }
  };

  const entries = Object.entries(materials);

  return (
    <div className="material-manager">
      <div className="material-manager-header">
        <h3 className="material-manager-title">
          <ImageIcon className="mr-2 h-4 w-4" />
          材质包管理
        </h3>
        <button
          type="button"
          className="control-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? '导入中...' : '导入贴图'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {entries.length === 0 ? (
        <p className="material-manager-empty">暂无材质，点击“导入贴图”添加。</p>
      ) : (
        <div className="material-grid">
          {entries.map(([name, url]) => (
            <div key={name} className="material-card">
              <div className="material-thumb-wrap">
                <img src={url} alt={name} className="material-thumb" />
              </div>
              <div className="material-info">
                <span className="material-name" title={name}>
                  {name}
                </span>
                {!BUILTIN_MATERIALS.includes(name) && (
                  <button
                    type="button"
                    className="material-delete"
                    onClick={() => handleDelete(name)}
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
