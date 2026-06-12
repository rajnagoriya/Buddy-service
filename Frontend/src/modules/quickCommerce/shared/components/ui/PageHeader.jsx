import React from 'react';
import { cn } from '@qc/lib/utils';

const PageHeader = ({ title, description, actions, badge, className }) => {
    return (
        <div className={cn("ds-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8", className)}>
            <div className="ds-page-title-group flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <h1 className="ds-h1 text-2xl font-semibold text-slate-900 tracking-tight">{title}</h1>
                    {badge && badge}
                </div>
                {description && <p className="ds-description text-sm text-slate-500">{description}</p>}
            </div>
            {actions && <div className="ds-page-actions flex items-center gap-3">{actions}</div>}
        </div>
    );
};

export default PageHeader;
