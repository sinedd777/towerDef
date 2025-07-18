# Tetris Shape Playing Card UI Component

## Overview
A stylized playing card interface for displaying and selecting Tetris shapes in the maze builder. The design mimics a traditional playing card with modern UI elements and interactive features.

## Visual Design

### Card Dimensions
- Width: 240px (standard playing card ratio)
- Height: 336px
- Border Radius: 12px

### Card Elements
1. **Main Card Face**
   - White background
   - Subtle shadow for depth
   - Rounded corners
   - Clean, minimal design

2. **Corner Indicators**
   - Position: Top-left and bottom-right
   - Content: Small version of current Tetris shape
   - Color: Matches the Tetris shape color

3. **Center Shape Display**
   - Large Tetris shape in the center
   - Grid-based layout (4x4)
   - Colored cells matching the shape's color
   - Proportional scaling to card size

4. **Card Stack Effect**
   - Multiple layered cards behind the main card
   - Subtle shadow and offset for depth
   - 3D perspective for realism

## Interactive Features

### Hover State
- Reveals instruction panel
- Smooth transition animation
- Semi-transparent black background
- White text for readability

### Instructions Panel Content
```
• Press T to pick up next shape
• Press R to rotate shape
• Click to place shape
• Block enemy paths strategically
```

### Card Selection Animation
- Triggered by pressing 'T'
- Card flips and fades out
- Reveals next card in stack
- Updates shapes remaining counter

### Counter Display
- Position: Below card stack
- Format: "Shapes remaining: X"
- White text with shadow for visibility
- Updates after each card selection

## States

### Default State
- Static card display
- Visible stack effect
- Counter shown

### Hover State
- Instructions panel appears
- Subtle hover effect on card

### Selection State
- Flip and fade animation
- Stack adjusts to show next card
- Counter decrements

## Technical Implementation

### CSS Features
- Transform-style: preserve-3d
- Perspective for 3D effects
- Transitions for smooth animations
- Grid layout for Tetris shape
- Pseudo-elements for stack effect

### Animation Keyframes
- Card flip: 360-degree rotation
- Fade out effect
- Upward movement
- Scale reduction

### Accessibility
- High contrast text
- Clear instructions
- Adequate text size
- Smooth animations

## Integration Notes
- Replaces current maze builder panel
- Maintains existing functionality
- Enhances visual appeal
- Improves user experience

## Dependencies
- Font: Arial (system font)
- No external libraries required
- CSS3 features for animations
- Modern browser compatibility 