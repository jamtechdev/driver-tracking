/**
 * Report Incident Modal Context - Open Report Incident modal from anywhere
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface ReportIncidentModalContextType {
  visible: boolean;
  open: () => void;
  close: () => void;
}

const ReportIncidentModalContext = createContext<ReportIncidentModalContextType | null>(null);

export const ReportIncidentModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <ReportIncidentModalContext.Provider value={{ visible, open, close }}>
      {children}
    </ReportIncidentModalContext.Provider>
  );
};

export const useReportIncidentModal = (): ReportIncidentModalContextType => {
  const ctx = useContext(ReportIncidentModalContext);
  if (!ctx) throw new Error('useReportIncidentModal must be used within ReportIncidentModalProvider');
  return ctx;
};
