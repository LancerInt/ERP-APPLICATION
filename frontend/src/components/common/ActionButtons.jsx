import { Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import usePermissions from '../../hooks/usePermissions.js';

export default function ActionButtons({ moduleName, editPath, onDelete, row }) {
  const { canEdit, canDelete } = usePermissions();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      {canEdit(moduleName) && editPath && (
        <button onClick={() => navigate(editPath)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
          <Pencil size={16} />
        </button>
      )}
      {canDelete(moduleName) && onDelete && (
        <button onClick={() => onDelete(row)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
