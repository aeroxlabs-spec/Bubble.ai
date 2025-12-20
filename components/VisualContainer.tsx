import React from 'react';
import { VisualMetadata } from '../types';
import DesmosGraph from './DesmosGraph';
import JSXGraphContainer from './JSXGraphContainer';

interface VisualContainerProps {
  metadata?: VisualMetadata;
  className?: string;
}

const VisualContainer: React.FC<VisualContainerProps> = ({ metadata, className = "" }) => {
  if (!metadata) return null;

  return (
    <div className={`w-full ${className} animate-in fade-in duration-500`}>
      {metadata.type === 'desmos' ? (
        <DesmosGraph expressions={metadata.data.split(';')} />
      ) : (
        <JSXGraphContainer commands={metadata.data} />
      )}
    </div>
  );
};

export default VisualContainer;