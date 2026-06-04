import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { emptyForm, BOOKS_PAGE_SIZE } from '../constants';
import {
  getBookQuantity,
  getBookAvailable,
  isLowStockBook
} from '../utils/bookHelpers';
import { appendStatusMessage, joinStatusParts } from '../utils/statusMessages';

export function useAdminBooks({ user, setMessage, logAction, setActiveSection }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [bookPage, setBookPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [bookFormStatus, setBookFormStatus] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [qrGeneratingId, setQrGeneratingId] = useState(null);
  const [formVisible, setFormVisible] = useState(false);

  const loadBooks = async ({ preserveMessage = false } = {}) => {
    setLoading(true);
    const result = await api.getBooks();
    if (result.success) {
      setBooks(Array.isArray(result.books) ? result.books : []);
      if (!preserveMessage) setMessage('');
    } else {
      setMessage(result.message || 'Failed to load books.');
    }
    setLoading(false);
  };

  useEffect(() => {
    setBookPage(1);
  }, [searchQuery, stockFilter]);

  useEffect(() => {
    if (!formVisible) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [formVisible]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl('');
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [coverFile]);

  const summary = useMemo(() => {
    const totalTitles = books.length;
    const totalCopies = books.reduce((sum, book) => sum + getBookQuantity(book), 0);
    const availableCopies = books.reduce((sum, book) => sum + getBookAvailable(book), 0);
    const lowStock = books.filter(isLowStockBook).length;
    const outOfStock = books.filter((book) => getBookAvailable(book) === 0).length;
    return {
      totalTitles,
      totalCopies,
      availableCopies,
      borrowedCopies: Math.max(totalCopies - availableCopies, 0),
      lowStock,
      outOfStock
    };
  }, [books]);

  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const matchesQuery = !query || (
        String(book.title || '').toLowerCase().includes(query) ||
        String(book.author || '').toLowerCase().includes(query) ||
        String(book.isbn || '').toLowerCase().includes(query) ||
        String(book.category || '').toLowerCase().includes(query)
      );

      if (!matchesQuery) return false;
      const available = getBookAvailable(book);
      if (stockFilter === 'low') return isLowStockBook(book);
      if (stockFilter === 'out') return available === 0;
      return true;
    });
  }, [books, searchQuery, stockFilter]);

  const bookPageCount = Math.max(1, Math.ceil(filteredBooks.length / BOOKS_PAGE_SIZE));
  const currentBookPage = Math.min(bookPage, bookPageCount);
  const paginatedBooks = useMemo(() => {
    const startIndex = (currentBookPage - 1) * BOOKS_PAGE_SIZE;
    return filteredBooks.slice(startIndex, startIndex + BOOKS_PAGE_SIZE);
  }, [filteredBooks, currentBookPage]);
  const pageStart = filteredBooks.length === 0 ? 0 : ((currentBookPage - 1) * BOOKS_PAGE_SIZE) + 1;
  const pageEnd = Math.min(currentBookPage * BOOKS_PAGE_SIZE, filteredBooks.length);

  const categorySummary = useMemo(() => {
    const counts = books.reduce((acc, book) => {
      const key = book.category || 'Uncategorized';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [books]);

  const lowStockBooks = useMemo(
    () => books.filter(isLowStockBook),
    [books]
  );

  const handleQuickAddBook = () => {
    setActiveSection('books');
    setEditingId(null);
    setForm(emptyForm);
    setCoverFile(null);
    setCoverPreviewUrl('');
    setBookFormStatus('');
    setQrFile(null);
    setFormVisible(true);
  };

  const scrollToSection = (sectionId) => {
    setActiveSection('circulation');
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setCoverFile(null);
    setCoverPreviewUrl('');
    setBookFormStatus('');
    setQrFile(null);
    setFormVisible(false);
  };

  const handleCoverFileChange = (event) => {
    const nextFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setCoverFile(nextFile);
  };

  const handleQrFileChange = (event) => {
    const nextFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setQrFile(nextFile);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.author.trim()) {
      setBookFormStatus('Title and author are required.');
      setMessage('Title and author are required.');
      return;
    }

    setSaving(true);
    setBookFormStatus(coverFile ? 'Saving book and uploading cover...' : 'Saving book...');
    const selectedCoverFile = coverFile;
    const selectedQrFile = qrFile;
    const payload = {
      ...form,
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn.trim(),
      category: form.category.trim(),
      intro: form.intro.trim(),
      quantity: Number(form.quantity || 1)
    };

    const isAddingBook = !editingId;
    const result = editingId
      ? await api.updateBook({ id: editingId, ...payload })
      : await api.addBook(payload);

    let combinedMessage = result.message || (result.success ? 'Saved.' : 'Failed to save.');
    let uploadFailed = false;
    const mediaSuccesses = [];
    if (result.success) {
      const targetBookId = editingId || Number(result.id || result.book_id || result.bookId || 0);
      if (targetBookId > 0) {
        if (selectedCoverFile) {
          setBookFormStatus('Uploading cover image...');
          const uploadResult = await api.uploadBookCover(targetBookId, selectedCoverFile);
          if (uploadResult.success) {
            mediaSuccesses.push('Cover uploaded');
          } else {
            combinedMessage = appendStatusMessage(combinedMessage, `Cover upload failed: ${uploadResult.message || 'Unknown error'}`);
            uploadFailed = true;
          }
        }

        if (selectedQrFile) {
          setBookFormStatus('Uploading QR image...');
          const uploadResult = await api.uploadBookQr(targetBookId, selectedQrFile);
          if (uploadResult.success) {
            mediaSuccesses.push('QR uploaded');
          } else {
            combinedMessage = appendStatusMessage(combinedMessage, `QR upload failed: ${uploadResult.message || 'Unknown error'}`);
            uploadFailed = true;
          }
        } else if (isAddingBook) {
          setBookFormStatus('Generating QR code...');
          const generateResult = await api.generateBookQr(targetBookId);
          if (generateResult.success) {
            mediaSuccesses.push('QR generated');
          } else {
            combinedMessage = appendStatusMessage(combinedMessage, `Book was added, but QR generation failed: ${generateResult.message || 'Unknown error'}`);
            uploadFailed = true;
          }
        }
      } else if (selectedCoverFile || selectedQrFile || isAddingBook) {
        uploadFailed = true;
        combinedMessage = appendStatusMessage(combinedMessage, 'Media upload skipped: the saved book ID was missing');
      }

      if (mediaSuccesses.length > 0) {
        combinedMessage = appendStatusMessage(combinedMessage, joinStatusParts(mediaSuccesses));
      }

      logAction(editingId ? 'Book Updated' : 'Book Added', payload.title);
      if (uploadFailed) {
        setBookFormStatus(combinedMessage);
      } else {
        resetForm();
      }
    } else {
      setBookFormStatus(combinedMessage);
    }
    setSaving(false);
    setMessage(combinedMessage);
    if (result.success) await loadBooks({ preserveMessage: true });
  };

  const handleEdit = (book) => {
    setEditingId(Number(book.id));
    setFormVisible(true);
    setForm({
      title: String(book.title || ''),
      author: String(book.author || ''),
      isbn: String(book.isbn || ''),
      category: String(book.category || ''),
      intro: String(book.intro || ''),
      quantity: getBookQuantity(book) || 1
    });
    setCoverFile(null);
    setCoverPreviewUrl('');
    setBookFormStatus('');
    setQrFile(null);
    setActiveSection('books');
  };

  const handleGenerateBookQr = async (book) => {
    const bookId = Number(book.id);
    if (!bookId || qrGeneratingId) return;

    setQrGeneratingId(bookId);
    const result = await api.generateBookQr(bookId);
    setQrGeneratingId(null);
    setMessage(result.message || (result.success ? 'QR generated.' : 'QR generation failed.'));
    if (result.success) {
      logAction('Book QR Generated', book.title);
      loadBooks();
    }
  };

  const handleArchive = async (id, title) => {
    const confirmed = window.confirm('Archive this book? It will be hidden from book lists but kept in the database.');
    if (!confirmed) return;

    const result = await api.archiveBook(id);
    setMessage(result.message || (result.success ? 'Book archived.' : 'Failed to archive book.'));
    if (result.success) {
      logAction('Book Archived', title);
      loadBooks();
    }
  };

  const handleRestock = async (book) => {
    const payload = {
      id: Number(book.id),
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      category: book.category || '',
      quantity: getBookQuantity(book) + 1
    };
    const result = await api.updateBook(payload);
    setMessage(result.message || (result.success ? 'Book restocked.' : 'Restock failed.'));
    if (result.success) {
      logAction('Book Restocked', book.title);
      loadBooks();
    }
  };

  const handleExportCsv = () => {
    const header = ['Title', 'Author', 'ISBN', 'Category', 'Quantity', 'Available'];
    const rows = filteredBooks.map((book) => [
      `"${String(book.title || '').replace(/"/g, '""')}"`,
      `"${String(book.author || '').replace(/"/g, '""')}"`,
      `"${String(book.isbn || '').replace(/"/g, '""')}"`,
      `"${String(book.category || '').replace(/"/g, '""')}"`,
      getBookQuantity(book),
      getBookAvailable(book)
    ]);
    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'library-books.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    logAction('Export', 'CSV exported');
  };

  return {
    books,
    setBooks,
    loading,
    setLoading,
    saving,
    setSaving,
    searchQuery,
    setSearchQuery,
    stockFilter,
    setStockFilter,
    bookPage,
    setBookPage,
    form,
    setForm,
    editingId,
    setEditingId,
    coverFile,
    setCoverFile,
    coverPreviewUrl,
    setCoverPreviewUrl,
    bookFormStatus,
    setBookFormStatus,
    qrFile,
    setQrFile,
    qrGeneratingId,
    setQrGeneratingId,
    formVisible,
    setFormVisible,
    loadBooks,
    summary,
    filteredBooks,
    bookPageCount,
    currentBookPage,
    paginatedBooks,
    pageStart,
    pageEnd,
    categorySummary,
    lowStockBooks,
    handleQuickAddBook,
    scrollToSection,
    resetForm,
    handleCoverFileChange,
    handleQrFileChange,
    handleSubmit,
    handleEdit,
    handleGenerateBookQr,
    handleArchive,
    handleRestock,
    handleExportCsv
  };
}
