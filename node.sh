#!/bin/bash -x

# if [ "$#" -ne 4 ]; then
#     echo "Usage: $0 <input_video> <output_frames> <output_video> <fps>"
#     exit 1
# fi
echo "running"
# Assign input and output filenames
# input_video="video_test.mp4"
# output_frames="test"
# output_video="video"
# fps="24"

# Function to convert video to frames
# convert_to_frames() {
#     input_video=$1
#     output_frames=$2
#     fps=$3
#     ffmpeg -i "$input_video" -vf "fps=$fps" "$output_frames/frame_%04d.png"
# }

# Function to convert frames to video
# convert_to_video() {
#     input_frames=$1
#     output_video=$2
#     fps=$3
#     ffmpeg -framerate "$fps" -i "$input_frames/frame_%04d.png" -c:v libx264 -pix_fmt yuv420p "$output_video"
# }

# # Main script
# input_video="input_video.mp4"
# output_frames="frames"
# output_video="output_video.mp4"
# fps=24

# Convert video to frames
# mkdir -p "$output_frames"
# convert_to_frames "$input_video" "$output_frames" "$fps"

# Convert frames to video
# convert_to_video "$output_frames" "$output_video" "$fps"

# echo "Conversion complete."
