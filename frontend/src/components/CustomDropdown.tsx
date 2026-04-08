import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface DropdownOption {
  id: string | number;
  name: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder: string;
  icon: React.ReactNode;
  searchable?: boolean;
  disabled?: boolean;
}

export default function CustomDropdown({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  icon, 
  searchable = false, 
  disabled = false 
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = searchable 
    ? options.filter(opt => opt.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const selectedOption = options.find(opt => opt.id === value);

  return (
    <div className={`custom-dropdown ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
       <div 
         className="dropdown-control" 
         onClick={() => !disabled && setIsOpen(!isOpen)}
       >
         <div className="dropdown-control-left">
           <span className="dropdown-icon">{icon}</span>
           <span className={`dropdown-value ${!selectedOption ? 'placeholder' : ''}`}>
             {selectedOption ? selectedOption.name : placeholder}
           </span>
         </div>
         <ChevronDown className={`dropdown-chevron ${isOpen ? 'open' : ''}`} size={18} />
       </div>

       {isOpen && (
         <div className="dropdown-menu">
           {searchable && (
             <div className="dropdown-search">
                <Search size={14} className="search-icon" />
                <input 
                  type="text" 
                  placeholder={`Search ${placeholder.replace("Select ", "").toLowerCase()}...`} 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
             </div>
           )}
           <div className="dropdown-options">
             {filteredOptions.length > 0 ? filteredOptions.map(opt => (
               <div 
                 key={opt.id} 
                 className={`dropdown-option ${value === opt.id ? 'selected' : ''}`}
                 onClick={() => {
                   onChange(opt.id);
                   setIsOpen(false);
                   setSearchTerm("");
                 }}
               >
                 {opt.name}
               </div>
             )) : (
               <div className="dropdown-empty">No results found</div>
             )}
           </div>
         </div>
       )}
    </div>
  );
}
