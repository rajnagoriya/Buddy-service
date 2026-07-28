import os
import re

filename = "/Users/rajnagoriya/code/appzeto/buddy/Buddy-service/Frontend/src/modules/DeliveryV2/pages/DeliveryHomeV2.jsx"

with open(filename, 'r') as f:
    content = f.read()

# 1. Add state
state_code = "  const [isModalMinimized, setIsModalMinimized] = useState(false);\n  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);"
content = content.replace("  const [isModalMinimized, setIsModalMinimized] = useState(false);", state_code)

# 2. Add useEffect
effect_code = """
  useEffect(() => {
    const handleHide = () => setIsBottomNavHidden(true);
    const handleShow = () => setIsBottomNavHidden(false);
    
    window.addEventListener('hideDeliveryBottomNav', handleHide);
    window.addEventListener('showDeliveryBottomNav', handleShow);
    
    return () => {
      window.removeEventListener('hideDeliveryBottomNav', handleHide);
      window.removeEventListener('showDeliveryBottomNav', handleShow);
    };
  }, []);
"""

content = content.replace("  // ─── EFFECTS ───", "  // ─── EFFECTS ───\n" + effect_code)

# 3. Hide bottom nav
bottom_nav_pattern = r'\{\/\* ─── 3\. BOTTOM NAV \(Premium Floating Pill Dock\) ─── \*\/}\s*<div className="fixed bottom-4 inset-x-6 z-\[500\] flex justify-center">'

new_bottom_nav = r'{/* ─── 3. BOTTOM NAV (Premium Floating Pill Dock) ─── */}\n      {!isBottomNavHidden && (\n        <div className="fixed bottom-4 inset-x-6 z-[500] flex justify-center">'

content = re.sub(r'\{\/\* ─── 3\. BOTTOM NAV \(Premium Floating Pill Dock\) ─── \*\/}\s*<div className="fixed bottom-4 inset-x-6 z-\[500\] flex justify-center">', new_bottom_nav, content)

# We need to close the added block `)`
# The bottom nav div ends around line 1600.
# Let's find the end of the div by matching the surrounding context.
content = content.replace("""        </div>\n      </div>\n    </div>\n  );\n}""", """        </div>\n      </div>\n      )}\n    </div>\n  );\n}""")

with open(filename, 'w') as f:
    f.write(content)
print("done")
