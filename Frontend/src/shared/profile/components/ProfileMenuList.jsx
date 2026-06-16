import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@food/components/ui/card";
import { motion } from "framer-motion";

export default function ProfileMenuList({ sections, onAction, getItemBadge, getItemValue, getItemSub }) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title}>
          <div className="profile-section-title">
            <div className="profile-section-bar" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{section.title}</h3>
          </div>
          <div className="space-y-2">
            {section.items.map((item) => {
              const Icon = item.icon;
              const badge = getItemBadge(item.badgeKey);
              const value = getItemValue(item.valueKey);
              const sub = getItemSub(item);

              const content = (
                <Card className="profile-menu-card py-0 border-0 dark:border-gray-800">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 shrink-0">
                        <Icon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-medium text-gray-900 dark:text-white">{item.label}</p>
                        {sub && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sub}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {value && (
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{value}</span>
                      )}
                      {badge && (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                          {badge}
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                  </CardContent>
                </Card>
              );

              if (item.type === "action") {
                return (
                  <motion.div
                    key={item.label}
                    whileHover={{ x: 4, scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => onAction(item.action, item)}
                  >
                    {content}
                  </motion.div>
                );
              }

              return (
                <Link key={item.label} to={item.path} className="block">
                  <motion.div
                    whileHover={{ x: 4, scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  >
                    {content}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
