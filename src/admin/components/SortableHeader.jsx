import React from 'react';

const SortableHeader = ({ label, field, activeField, direction, onSort }) => {
  const isActive = activeField === field;
  return (
    <button
      type="button"
      className={`sortable-th ${isActive ? 'is-active' : ''}`}
      onClick={() => onSort(field)}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <span className={`sort-indicator ${isActive ? 'is-visible' : ''}`} aria-hidden="true">
        {isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
};

export default SortableHeader;
