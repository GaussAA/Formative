/**
 * 技术需求部分组件
 * 显示技术相关的需求选项
 */

'use client';

import React from 'react';

interface TechRequirement {
  label: string;
  checked: boolean;
  trueLabel: string;
  falseLabel: string;
}

interface TechRequirementsSectionProps {
  requirements: TechRequirement[];
  getHighlightClass?: (key: string) => string;
}

export function TechRequirementsSection({ requirements, getHighlightClass }: TechRequirementsSectionProps) {
  return (
    <div className="bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm">
      <div className="flex items-center mb-3">
        <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">技术需求</div>
      </div>
      <div className="space-y-2 pl-3.5">
        {requirements.map((req) => (
          <TechRequirementItem
            key={req.label}
            label={req.label}
            checked={req.checked}
            trueLabel={req.trueLabel}
            falseLabel={req.falseLabel}
            highlightClass={getHighlightClass?.(req.label)}
          />
        ))}
      </div>
    </div>
  );
}

interface TechRequirementItemProps {
  label: string;
  checked: boolean;
  trueLabel: string;
  falseLabel: string;
  highlightClass?: string;
}

function TechRequirementItem({ checked, trueLabel, falseLabel, highlightClass }: TechRequirementItemProps) {
  return (
    <div className={`flex items-center text-sm transition-all duration-300 ${highlightClass || ''}`}>
      {checked ? (
        <>
          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-gray-900">{trueLabel}</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-gray-500">{falseLabel}</span>
        </>
      )}
    </div>
  );
}
