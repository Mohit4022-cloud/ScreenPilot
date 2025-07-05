import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Camera, Monitor, CheckCircle, XCircle, Loader } from 'lucide-react';
import type { PermissionDialogProps } from '../../shared/types';

type PermissionStatus = 'checking' | 'granted' | 'denied' | 'pending';

interface Permission {
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: PermissionStatus;
}

const PermissionDialog: React.FC<PermissionDialogProps> = ({ onComplete }) => {
  const [permissions, setPermissions] = useState<Permission[]>([
    {
      type: 'screen',
      name: 'Screen Recording',
      description: 'Required to capture and analyze your screen',
      icon: <Monitor className="w-5 h-5" />,
      status: 'checking'
    },
    {
      type: 'camera',
      name: 'Camera Access',
      description: 'Optional for enhanced workspace analysis',
      icon: <Camera className="w-5 h-5" />,
      status: 'checking'
    },
    {
      type: 'privacy',
      name: 'Privacy Settings',
      description: 'We never store screenshots without consent',
      icon: <Shield className="w-5 h-5" />,
      status: 'checking'
    }
  ]);

  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    // TODO: Implement proper permission checking
    // For now, mark all as granted for testing
    setPermissions(prev => prev.map(p => ({
      ...p,
      status: 'granted'
    })));
  };

  const requestPermission = async (index: number) => {
    const permission = permissions[index];
    
    setPermissions(prev => prev.map((p, i) => 
      i === index ? { ...p, status: 'checking' } : p
    ));

    // TODO: Implement proper permission request
    // For now, simulate granting permission
    setTimeout(() => {
      setPermissions(prev => prev.map((p, i) => 
        i === index ? { ...p, status: 'granted' } : p
      ));
      
      if (index < permissions.length - 1) {
        setTimeout(() => setCurrentStep(index + 1), 500);
      }
    }, 1000);
  };

  const allGranted = permissions.every(p => p.status === 'granted');
  const requiredGranted = permissions
    .filter(p => p.type === 'screen')
    .every(p => p.status === 'granted');

  const getStatusIcon = (status: Permission['status']) => {
    switch (status) {
      case 'checking':
        return <Loader className="w-4 h-4 animate-spin" />;
      case 'granted':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-2xl font-bold mb-2">Welcome to ScreenPilot</h1>
        <p className="text-text-secondary">
          We need a few permissions to get started
        </p>
      </motion.div>

      <div className="space-y-4">
        {permissions.map((permission, index) => (
          <motion.div
            key={permission.type}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`
              p-4 rounded-lg border transition-all
              ${currentStep === index ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/5'}
              ${permission.status === 'granted' ? 'opacity-60' : ''}
            `}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white/10">
                {permission.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{permission.name}</h3>
                <p className="text-sm text-text-secondary mb-3">
                  {permission.description}
                </p>
                {currentStep === index && permission.status === 'pending' && (
                  <button
                    onClick={() => requestPermission(index)}
                    className="px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent/90 transition-colors"
                  >
                    Grant Permission
                  </button>
                )}
              </div>
              <div className="mt-1">
                {getStatusIcon(permission.status)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {requiredGranted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <button
            onClick={onComplete}
            className="px-6 py-3 bg-accent text-black rounded-lg hover:bg-accent/90 transition-colors font-semibold"
          >
            {allGranted ? 'Get Started' : 'Continue with Basic Features'}
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default PermissionDialog;