import React from 'react';

const AdminBookFormModal = ({ admin }) => {
  const {
    formVisible,
    saving,
    resetForm,
    editingId,
    form,
    setForm,
    handleSubmit,
    handleCoverFileChange,
    coverFile,
    coverPreviewUrl,
    handleQrFileChange,
    qrFile,
    bookFormStatus
  } = admin;

  if (!formVisible) return null;

  return (
    <div
      className="book-form-modal-backdrop"
      onClick={() => {
        if (!saving) resetForm();
      }}
      role="presentation"
    >
      <div className="content-section book-form-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="section-title">{editingId ? 'Edit Book' : 'Add Book'}</h3>
        <form className="book-form" onSubmit={handleSubmit}>
          <input type="text" placeholder="Title" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          <input type="text" placeholder="Author" value={form.author} onChange={(e) => setForm((prev) => ({ ...prev, author: e.target.value }))} />
          <input type="text" placeholder="ISBN" value={form.isbn} onChange={(e) => setForm((prev) => ({ ...prev, isbn: e.target.value }))} />
          <input type="text" placeholder="Category" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} />
          <textarea
            placeholder="Book summary / intro"
            value={form.intro}
            onChange={(e) => setForm((prev) => ({ ...prev, intro: e.target.value }))}
            rows={4}
          />
          <input type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} />
          <div className="file-picker">
            <label htmlFor={`${editingId ? 'edit' : 'add'}-book-cover-upload-${editingId || 'new'}`} className="file-picker-label">Cover image</label>
            <input
              id={`${editingId ? 'edit' : 'add'}-book-cover-upload-${editingId || 'new'}`}
              className="file-picker-input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg"
              onChange={handleCoverFileChange}
            />
            <span className="file-picker-note">
              {coverFile
                ? `${coverFile.name} selected`
                : 'No cover image chosen'}
            </span>
            {coverPreviewUrl && (
              <img className="cover-file-preview" src={coverPreviewUrl} alt="Selected cover preview" />
            )}
          </div>
          <div className="file-picker">
            <label htmlFor={`${editingId ? 'edit' : 'add'}-book-qr-upload-${editingId || 'new'}`} className="file-picker-label">QR image</label>
            <input
              id={`${editingId ? 'edit' : 'add'}-book-qr-upload-${editingId || 'new'}`}
              className="file-picker-input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg"
              onChange={handleQrFileChange}
            />
            <span className="file-picker-note">
              {qrFile
                ? `${qrFile.name} selected`
                : 'No QR image chosen'}
            </span>
          </div>
          {!editingId && (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0 }}>
              A QR code will be generated automatically when no QR image is uploaded.
            </p>
          )}
          {editingId && (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0 }}>
              Leave files empty to keep existing cover and QR images.
            </p>
          )}
          {bookFormStatus && (
            <div
              className={`book-form-status ${bookFormStatus.toLowerCase().includes('failed') ? 'error' : ''}`}
              role="status"
            >
              {bookFormStatus}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="action-btn" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update Book' : 'Add Book'}
            </button>
            <button type="button" className="action-btn danger" onClick={resetForm} disabled={saving}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminBookFormModal;
