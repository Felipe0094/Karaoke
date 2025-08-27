import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ListMusic } from 'lucide-react';

const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="p-4 text-white shadow-md bg-white/10 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto grid grid-cols-3 items-center">
        <div></div>
        <h1 className="text-2xl md:text-3xl font-bold text-center">KaraokêApp</h1>
        <div className="flex gap-2 justify-self-end">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="text-white border-white/50 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white transition-all"
            aria-label="Início"
          >
            <Home className="h-5 w-5" />
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin')}
            className="text-white border-white/50 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white transition-all"
            aria-label="Admin"
          >
            <ListMusic className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
