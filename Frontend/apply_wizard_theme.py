import os

filename = "/Users/rajnagoriya/code/appzeto/buddy/Buddy-service/Frontend/src/modules/driver/pages/OnboardingWizard.jsx"

with open(filename, 'r') as f:
    content = f.read()

replacements = [
    # Main container
    ('bg-[#0c1410] text-white', 'bg-gray-50 text-gray-900'),
    ('sm:border-white/5', 'sm:border-gray-100'),
    ('bg-[#0c1410]', 'bg-gray-50'),
    
    # Hero header
    ('from-[#1f3a23] via-[#2a4e2f] to-[#3a6b41]', 'from-green-600 via-green-700 to-green-800'),
    ('text-[#9bc78a]', 'text-green-200'),
    ('bg-white/10 px-2.5', 'bg-white/20 px-2.5'), # header step count
    ('bg-[#88c170] rounded-full', 'bg-white rounded-full'), # progress bar filled
    ('bg-[#88c170]/20 text-[#cfe3c6] hover:bg-[#88c170]/30', 'bg-white/20 text-white hover:bg-white/30'), # done step button
    ('bg-white text-[#0c1410]', 'bg-white text-green-700'), # active step button
    ('bg-white/10 text-white/60 hover:bg-white/15', 'bg-white/10 text-white/70 hover:bg-white/20'), # reachable step button
    ('bg-white/5 text-white/25', 'bg-white/5 text-white/40'), # disabled step button
    ('text-white/60 mt-1', 'text-green-50 mt-1'), # subtitle in header
    ('border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] font-medium text-amber-100', 'border-amber-400/30 bg-amber-500/20 px-3 py-2 text-[12px] font-medium text-amber-50'), # alert in header

    # General text & borders outside hero
    ('text-white/60', 'text-gray-500'),
    ('text-white/50', 'text-gray-400'),
    ('text-white/40', 'text-gray-400'),
    ('text-white/30', 'text-gray-300'),
    ('text-white/20', 'text-gray-200'),
    ('border-white/10', 'border-gray-200'),
    ('border-white/5', 'border-gray-100'),
    ('bg-white/5', 'bg-white'),
    ('bg-white/10', 'bg-gray-50'),
    
    # Text colors
    ('text-white', 'text-gray-900'),
    # Restore white text for buttons and specific components where we actually want white
    ('text-gray-900 font-extrabold', 'text-white font-extrabold'),
    ('text-gray-900 bg-green-600', 'text-white bg-green-600'),

    # Accents
    ('text-[#88c170]', 'text-green-600'),
    ('bg-[#88c170]', 'bg-green-600'),
    ('hover:bg-[#7eb463]', 'hover:bg-green-700'),
    ('border-[#88c170]/30', 'border-green-600/30'),
    ('bg-[#88c170]/10', 'bg-green-50'),
    ('ring-[#88c170]/30', 'ring-green-600/30'),
    ('shadow-[#88c170]/20', 'shadow-green-600/20'),

    # Specific structural tweaks
    ('bg-white', 'bg-white shadow-sm'), # adding subtle shadows to cards that had bg-white/5 which turned to bg-white
    ('bg-gray-50 flex items-center justify-center shrink-0', 'bg-gray-100 flex items-center justify-center shrink-0'), # Fix icons backgrounds

]

# Execute replacements sequentially
for old, new in replacements:
    content = content.replace(old, new)

# Quick fixes for over-replacements
content = content.replace('bg-white shadow-sm/20', 'bg-white/20')
content = content.replace('bg-white shadow-sm/10', 'bg-white/10')
content = content.replace('bg-white shadow-sm text-green-700', 'bg-white text-green-700')
content = content.replace('bg-white shadow-sm rounded-full', 'bg-white rounded-full')
content = content.replace('text-gray-900/60', 'text-white/60') # Fix any broken alpha classes
content = content.replace('text-gray-900/70', 'text-white/70')
content = content.replace('text-gray-900/40', 'text-white/40')

with open(filename, 'w') as f:
    f.write(content)
print("done")
