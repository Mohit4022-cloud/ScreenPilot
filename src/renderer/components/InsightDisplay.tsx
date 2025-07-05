import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, AlertTriangle, Keyboard, Zap } from 'lucide-react';
import type { InsightDisplayProps, InsightPriority, InsightCategory, Suggestion } from '../../shared/types';

const InsightDisplay: React.FC<InsightDisplayProps> = ({ insight }) => {
  const getPriorityColor = (priority: InsightPriority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 border-red-500/50';
      case 'medium':
        return 'bg-yellow-500/20 border-yellow-500/50';
      default:
        return 'bg-blue-500/20 border-blue-500/50';
    }
  };

  const getCategoryIcon = (category: InsightCategory) => {
    switch (category) {
      case 'ERROR_HELP':
        return <AlertTriangle className="w-4 h-4" />;
      case 'SHORTCUT':
        return <Keyboard className="w-4 h-4" />;
      case 'AUTOMATION':
        return <Zap className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={`
        absolute bottom-20 left-4 right-4 
        rounded-lg border p-4
        ${getPriorityColor(insight.priority)}
        backdrop-blur-md
      `}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-white/10">
          {getCategoryIcon(insight.category)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{insight.title}</h3>
          <p className="text-sm text-text-secondary mb-2">{insight.summary}</p>
          
          {insight.suggestions && insight.suggestions.length > 0 && (
            <div className="space-y-1">
              {insight.suggestions.slice(0, 3).map((suggestion: Suggestion, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="text-sm flex items-center gap-2"
                >
                  <span className="text-accent">→</span>
                  <span>{suggestion.text}</span>
                  {suggestion.confidence > 0.8 && (
                    <span className="text-xs text-green-500">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default InsightDisplay;